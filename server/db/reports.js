const { db } = require('./index');
const { calculatePriority, getDepartment } = require('../services/reportRules');
const { analyzeWithRules } = require('../services/aiAnalyzer');
const engagement = require('./engagement');
const { DAILY_REPORT_LIMIT, isDailyLimitReached } = require('../services/trustRules');

const reportSelect = `
  SELECT
    reports.id,
    reports.citizen_id AS citizenId,
    reports.location_name AS location,
    reports.title,
    reports.category,
    reports.description,
    reports.image_path AS imagePath,
    reports.status,
    reports.severity,
    reports.sentiment,
    reports.department,
    reports.priority,
    reports.ai_category AS aiCategory,
    reports.ai_severity AS aiSeverity,
    reports.ai_sentiment AS aiSentiment,
    reports.ai_department AS aiDepartment,
    reports.ai_provider AS aiProvider,
    reports.verified,
    reports.fake_flagged AS fakeFlagged,
    reports.fake_reason AS fakeReason,
    (SELECT details FROM report_events
      WHERE report_events.report_id = reports.id AND event_type = 'authority_response'
      ORDER BY id DESC LIMIT 1) AS publicResponse,
    reports.verified_by_ngo_id AS verifiedByNgoId,
    reports.verified_at AS verifiedAt,
    reports.accepted_by_ngo_id AS acceptedByNgoId,
    reports.accepted_by_org_name AS acceptedByOrgName,
    reports.accepted_at AS acceptedAt,
    reports.progress_note AS progressNote,
    reports.status_updated_at AS statusUpdatedAt,
    reports.created_at AS createdAt
  FROM reports
`;

const seedDemoReports = async (citizenId) => {
  const seed = db.transaction(() => {
    if (db.prepare('SELECT 1 FROM reports LIMIT 1').get()) return;

    const samples = [
      {
        location: 'Anna Nagar, Chennai',
        title: 'Damaged pathway',
        category: 'Road & Infrastructure',
        description: 'The pathway near the park entrance is damaged and difficult for pedestrians to use.',
        status: 'accepted',
      },
      {
        location: 'Mogappair, Chennai',
        title: 'Overflowing waste bin',
        category: 'Waste Management',
        description: 'Public waste bin overflowing near the bus stop causing hygiene issues.',
        status: 'resolved',
      },
      {
        location: 'Ambattur, Chennai',
        title: 'Broken streetlight',
        category: 'Public Safety',
        description: 'Streetlight pole #14 is non-functional creating visibility issues.',
        status: 'pending',
      },
    ];

    const insertLocation = db.prepare(`
      INSERT INTO locations (name) VALUES (?)
      ON CONFLICT(name) DO UPDATE SET name = excluded.name
      RETURNING id
    `);
    const insertReport = db.prepare(`
      INSERT INTO reports
        (citizen_id, location_id, location_name, title, category, description, image_path, status, severity, department, priority)
      VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)
    `);
    const insertUpdate = db.prepare(`
      INSERT INTO report_updates (report_id, actor_id, from_status, to_status, note)
      VALUES (?, ?, NULL, ?, 'Demo report')
    `);

    for (const sample of samples) {
      const location = insertLocation.get(sample.location);
      const { severity, priority } = calculatePriority({
        category: sample.category,
        sameLocationCount: db.prepare('SELECT COUNT(*) AS count FROM reports WHERE location_id = ?').get(location.id).count,
        description: sample.description,
      });
      const report = insertReport.run(
        citizenId,
        location.id,
        sample.location,
        sample.title,
        sample.category,
        sample.description,
        sample.status,
        severity,
        getDepartment(sample.category),
        priority,
      );
      insertUpdate.run(report.lastInsertRowid, citizenId, sample.status);
    }
  });
  seed();

  const existing = db.prepare(`
    SELECT id, title, category, location_id, description, verified
    FROM reports
  `).all();
  const updateClassification = db.prepare(`
    UPDATE reports SET severity = ?, department = ?, priority = ?,
      ai_category = ?, ai_severity = ?, ai_sentiment = ?, ai_department = ?, ai_provider = ?
    WHERE id = ?
  `);
  const backfill = db.transaction(() => {
    for (const report of existing) {
      const analysis = analyzeWithRules({ title: report.title, description: report.description });
      const sameLocationCount = db.prepare(`
        SELECT COUNT(*) AS count FROM reports WHERE location_id = ?
      `).get(report.location_id).count;
      const { severity, priority } = calculatePriority({
        category: report.category,
        sameLocationCount,
        description: report.description,
        verified: Boolean(report.verified),
        severity: analysis.severity,
      });
      updateClassification.run(
        severity,
        getDepartment(report.category),
        priority,
        analysis.category,
        analysis.severity,
        analysis.sentiment,
        analysis.department,
        'rules',
        report.id,
      );
    }
  });
  backfill();
};

const createReport = async ({
  citizenId,
  location,
  title,
  category,
  description,
  imagePath,
  aiAnalysis,
}) => {
  const save = db.transaction(() => {
    const todayCount = db.prepare(`
      SELECT COUNT(*) AS count FROM reports WHERE citizen_id = ? AND date(created_at) = date('now')
    `).get(citizenId).count;
    if (isDailyLimitReached(todayCount, DAILY_REPORT_LIMIT)) {
      const limitError = new Error('Daily report limit reached.');
      limitError.code = 'REPORT_DAILY_LIMIT';
      throw limitError;
    }
    let locationRow = db.prepare('SELECT id FROM locations WHERE name = ? COLLATE NOCASE').get(location);
    if (!locationRow) {
      const inserted = db.prepare('INSERT INTO locations (name) VALUES (?)').run(location);
      locationRow = { id: inserted.lastInsertRowid };
    }

    const sameLocationCount = db.prepare(`
      SELECT COUNT(*) AS count FROM reports WHERE location_id = ?
    `).get(locationRow.id).count;
    const { severity, priority } = calculatePriority({
      category,
      sameLocationCount,
      description,
      severity: aiAnalysis.severity,
    });

    const result = db.prepare(`
      INSERT INTO reports
        (citizen_id, location_id, location_name, title, category, description, image_path,
         severity, department, priority, ai_category, ai_severity, ai_sentiment, ai_department, ai_provider)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      citizenId,
      locationRow.id,
      location,
      title,
      category,
      description,
      imagePath,
      severity,
      getDepartment(category),
      priority,
      aiAnalysis.category,
      aiAnalysis.severity,
      aiAnalysis.sentiment,
      aiAnalysis.department,
      aiAnalysis.provider,
    );

    db.prepare(`
      INSERT INTO report_updates (report_id, actor_id, from_status, to_status, note)
      VALUES (?, ?, NULL, 'pending', 'Report submitted')
    `).run(result.lastInsertRowid, citizenId);
    engagement.recordReportEvent({
      reportId: result.lastInsertRowid,
      actorId: citizenId,
      eventType: 'submitted',
      details: 'Report submitted',
    });

    return result.lastInsertRowid;
  });

  return getReportById({ id: save(), role: 'authority' });
};

const getReports = async ({
  userId,
  role,
  page = 1,
  pageSize = 20,
  q = '',
  category = '',
  status = '',
  department = '',
  priority = '',
  from = '',
  to = '',
  scope = '',
}) => {
  const conditions = [];
  const parameters = [];
  if (role === 'citizen') {
    conditions.push('reports.citizen_id = ?');
    parameters.push(userId);
  }
  if (role === 'ngo' && scope === 'available') {
    conditions.push("reports.status = 'pending'");
  } else if (role === 'ngo' && scope === 'mine') {
    conditions.push("reports.status IN ('accepted', 'in_progress', 'resolved')");
    conditions.push('reports.accepted_by_ngo_id = ?');
    parameters.push(userId);
  }
  const baseConditions = [...conditions];
  const baseParameters = [...parameters];
  if (q) {
    conditions.push('(reports.title LIKE ? OR reports.location_name LIKE ? OR reports.description LIKE ?)');
    const search = `%${q}%`;
    parameters.push(search, search, search);
  }
  if (category) {
    conditions.push('reports.category = ?');
    parameters.push(category);
  }
  if (department) {
    conditions.push('reports.department = ?');
    parameters.push(department);
  }
  if (priority) {
    conditions.push('reports.priority = ?');
    parameters.push(priority);
  }
  if (status) {
    const statuses = status.split(',').filter((value) =>
      ['pending', 'accepted', 'in_progress', 'resolved'].includes(value));
    if (statuses.length) {
      conditions.push(`reports.status IN (${statuses.map(() => '?').join(', ')})`);
      parameters.push(...statuses);
    }
  }
  if (from) {
    conditions.push('date(reports.created_at) >= date(?)');
    parameters.push(from);
  }
  if (to) {
    conditions.push('date(reports.created_at) <= date(?)');
    parameters.push(to);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS total FROM reports ${where}`).get(...parameters).total;
  const baseWhere = baseConditions.length ? `WHERE ${baseConditions.join(' AND ')}` : '';
  const summaryRows = db.prepare(`
    SELECT status, COUNT(*) AS count FROM reports ${baseWhere} GROUP BY status
  `).all(...baseParameters);
  const categoryRows = db.prepare(`
    SELECT category, COUNT(*) AS count FROM reports ${baseWhere} GROUP BY category
  `).all(...baseParameters);
  const departmentRows = db.prepare(`
    SELECT DISTINCT department FROM reports ${baseWhere}
    ${baseConditions.length ? 'AND' : 'WHERE'} department IS NOT NULL AND department != ''
  `).all(...baseParameters);
  const rows = db.prepare(`
    ${reportSelect} ${where}
    ORDER BY reports.created_at DESC, reports.id DESC
    LIMIT ? OFFSET ?
  `).all(...parameters, pageSize, (page - 1) * pageSize);
  return {
    reports: rows.map((row) => ({
    ...row,
    fileName: row.imagePath ? row.imagePath.split(/[\\/]/).pop() : '',
    imageUrl: row.imagePath ? `/${row.imagePath.replace(/\\/g, '/')}` : '',
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    summary: summaryRows.reduce((summary, row) => {
      summary[row.status] = row.count;
      summary.total += row.count;
      return summary;
    }, { total: 0, pending: 0, accepted: 0, in_progress: 0, resolved: 0 }),
    categoryCounts: Object.fromEntries(categoryRows.map((row) => [row.category, row.count])),
    departments: departmentRows.map((row) => row.department),
  };
};

const getReportById = async ({ id, userId, role }) => {
  const where = role === 'citizen'
    ? 'WHERE reports.id = ? AND reports.citizen_id = ?'
    : 'WHERE reports.id = ?';
  const statement = db.prepare(`${reportSelect} ${where}`);
  const row = role === 'citizen' ? statement.get(id, userId) : statement.get(id);
  if (!row) return null;
  return {
    ...row,
    fileName: row.imagePath ? row.imagePath.split(/[\\/]/).pop() : '',
    imageUrl: row.imagePath ? `/${row.imagePath.replace(/\\/g, '/')}` : '',
  };
};

const getReportHistory = async ({ id, userId, role }) => {
  const report = role === 'citizen'
    ? db.prepare('SELECT id FROM reports WHERE id = ? AND citizen_id = ?').get(id, userId)
    : db.prepare('SELECT id FROM reports WHERE id = ?').get(id);
  if (!report) return null;
  const visibility = ['authority', 'admin'].includes(role) ? '' : 'AND report_events.is_public = 1';
  return db.prepare(`
    SELECT report_events.id, report_events.event_type AS eventType, report_events.details,
      report_events.is_public AS isPublic, report_events.created_at AS createdAt,
      users.full_name AS actorName
    FROM report_events JOIN users ON users.id = report_events.actor_id
    WHERE report_events.report_id = ? ${visibility}
    ORDER BY report_events.created_at DESC, report_events.id DESC
  `).all(id);
};

const acceptReport = async ({ id, ngoId, organizationName, ngoType }) => {
  const update = db.transaction(() => {
    const report = db.prepare(`${reportSelect} WHERE reports.id = ?`).get(id);
    const availability = db.prepare(`
      SELECT status FROM ngo_availability WHERE ngo_id = ?
    `).get(ngoId)?.status || 'available';
    if (
      !report
      || report.status !== 'pending'
      || report.category !== ngoType
      || availability !== 'available'
    ) return null;
    db.prepare(`
      UPDATE reports
      SET status = 'accepted', accepted_by_ngo_id = ?, accepted_by_org_name = ?,
          accepted_at = CURRENT_TIMESTAMP, status_updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `).run(ngoId, organizationName, id);
    db.prepare(`
      INSERT INTO report_updates (report_id, actor_id, from_status, to_status, note)
      VALUES (?, ?, 'pending', 'accepted', 'Report accepted by NGO')
    `).run(id, ngoId);
    const title = report.title;
    const citizenId = report.citizenId;
    engagement.recordReportEvent({ reportId: id, actorId: ngoId, eventType: 'accepted', details: 'Report accepted by NGO' });
    engagement.recordAudit({ actorId: ngoId, action: 'report_accepted', recordType: 'report', recordId: id, details: `Accepted: ${title}` });
    engagement.notifyUser({ userId: citizenId, reportId: id, eventType: 'accepted', reportTitle: title });
    return true;
  });
  if (!update()) return null;
  return getReportById({ id, role: 'authority' });
};

const updateReportStatus = async ({ id, ngoId, status, note }) => {
  const update = db.transaction(() => {
    const report = db.prepare(`
      SELECT status, title, citizen_id AS citizenId FROM reports WHERE id = ? AND accepted_by_ngo_id = ?
    `).get(id, ngoId);
    const transitions = { accepted: 'in_progress', in_progress: 'resolved' };
    if (!report || transitions[report.status] !== status) return null;

    db.prepare(`
      UPDATE reports
      SET status = ?, progress_note = ?, status_updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND accepted_by_ngo_id = ?
    `).run(status, note || '', id, ngoId);
    db.prepare(`
      INSERT INTO report_updates (report_id, actor_id, from_status, to_status, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, ngoId, report.status, status, note || null);
    const eventType = status === 'resolved' ? 'resolved' : 'status_changed';
    engagement.recordReportEvent({ reportId: id, actorId: ngoId, eventType, details: note || `Status changed to ${status}` });
    engagement.recordAudit({ actorId: ngoId, action: eventType, recordType: 'report', recordId: id, details: `${report.status} → ${status}${note ? `: ${note}` : ''}` });
    engagement.notifyUser({ userId: report.citizenId, reportId: id, eventType, reportTitle: report.title });
    return true;
  });
  if (!update()) return null;
  return getReportById({ id, role: 'authority' });
};

const verifyReport = async ({ id, ngoId, ngoType }) => {
  const update = db.transaction(() => {
    const report = db.prepare(`
      SELECT id, category, location_id, description, title, citizen_id AS citizenId, ai_severity AS aiSeverity, verified
      FROM reports WHERE id = ?
    `).get(id);
    if (!report || report.verified) return null;
    if (ngoType && report.category !== ngoType) return null;

    const sameLocationCount = db.prepare(`
      SELECT COUNT(*) AS count FROM reports WHERE location_id = ?
    `).get(report.location_id).count;
    const { priority } = calculatePriority({
      category: report.category,
      sameLocationCount,
      description: report.description,
      severity: report.aiSeverity,
      verified: true,
    });
    db.prepare(`
      UPDATE reports
      SET verified = 1, verified_by_ngo_id = ?, verified_at = CURRENT_TIMESTAMP, priority = ?
      WHERE id = ? AND verified = 0
    `).run(ngoId, priority, id);
    db.prepare(`
      INSERT INTO report_updates (report_id, actor_id, from_status, to_status, note)
      VALUES (?, ?, (SELECT status FROM reports WHERE id = ?),
        (SELECT status FROM reports WHERE id = ?), 'Report verified by NGO')
    `).run(id, ngoId, id, id);
    engagement.recordReportEvent({ reportId: id, actorId: ngoId, eventType: 'verified', details: 'Report verified by NGO' });
    engagement.recordAudit({ actorId: ngoId, action: 'report_verified', recordType: 'report', recordId: id, details: `Verified: ${report.title}` });
    engagement.notifyUser({ userId: report.citizenId, reportId: id, eventType: 'verified', reportTitle: report.title });
    return true;
  });
  if (!update()) return null;
  return getReportById({ id, role: 'authority' });
};

const updateAuthorityAction = async ({ id, actorId, action, department, priority, reason, response }) => {
  const update = db.transaction(() => {
    const report = db.prepare('SELECT id, title, citizen_id AS citizenId, status, department, priority FROM reports WHERE id = ?').get(id);
    if (!report) return null;
    if (action === 'assign') {
      db.prepare('UPDATE reports SET department = ? WHERE id = ?').run(department, id);
      engagement.recordReportEvent({ reportId: id, actorId, eventType: 'department_assigned', details: `Department assigned: ${department}` });
      engagement.recordAudit({ actorId, action: 'department_assigned', recordType: 'report', recordId: id, details: `${report.department || 'Unassigned'} → ${department}` });
    } else if (action === 'priority') {
      db.prepare('UPDATE reports SET priority = ? WHERE id = ?').run(priority, id);
      engagement.recordReportEvent({ reportId: id, actorId, eventType: 'priority_changed', details: `${report.priority || 'medium'} → ${priority}: ${reason}` });
      engagement.recordAudit({ actorId, action: 'priority_changed', recordType: 'report', recordId: id, details: `${report.priority || 'medium'} → ${priority}: ${reason}` });
    } else if (action === 'respond') {
      engagement.recordReportEvent({ reportId: id, actorId, eventType: 'authority_response', details: response, isPublic: true });
      engagement.recordAudit({ actorId, action: 'authority_response', recordType: 'report', recordId: id, details: response });
      engagement.notifyUser({ userId: report.citizenId, reportId: id, eventType: 'authority_response', reportTitle: report.title });
    } else if (action === 'resolve') {
      if (report.status === 'resolved') return report;
      db.prepare(`UPDATE reports SET status = 'resolved', status_updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
      db.prepare(`
        INSERT INTO report_updates (report_id, actor_id, from_status, to_status, note)
        VALUES (?, ?, ?, 'resolved', 'Resolved by authority')
      `).run(id, actorId, report.status);
      engagement.recordReportEvent({ reportId: id, actorId, eventType: 'resolved', details: 'Resolved by authority' });
      engagement.recordAudit({ actorId, action: 'report_resolved', recordType: 'report', recordId: id, details: `${report.status} → resolved` });
      engagement.notifyUser({ userId: report.citizenId, reportId: id, eventType: 'resolved', reportTitle: report.title });
    } else if (action === 'flag') {
      db.prepare(`
        UPDATE reports SET fake_flagged = 1, fake_reason = ?, fake_flagged_by = ?, priority = 'low' WHERE id = ?
      `).run(reason, actorId, id);
      engagement.recordReportEvent({ reportId: id, actorId, eventType: 'flagged_fake', details: reason });
      engagement.recordAudit({ actorId, action: 'report_flagged_fake', recordType: 'report', recordId: id, details: reason });
    }
    return report;
  });
  const result = update();
  return result ? getReportById({ id, role: 'authority' }) : null;
};

module.exports = {
  createReport,
  getReports,
  getReportById,
  getReportHistory,
  acceptReport,
  updateReportStatus,
  verifyReport,
  updateAuthorityAction,
  seedDemoReports,
};
