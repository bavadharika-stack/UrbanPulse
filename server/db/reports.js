const { db } = require('./index');
const { calculatePriority, getDepartment } = require('../services/reportRules');
const { analyzeWithRules } = require('../services/aiAnalyzer');

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

    return result.lastInsertRowid;
  });

  return getReportById({ id: save(), role: 'authority' });
};

const getReports = async ({ userId, role }) => {
  const whereCitizen = role === 'citizen' ? 'WHERE reports.citizen_id = ?' : '';
  const statement = db.prepare(`${reportSelect} ${whereCitizen} ORDER BY reports.created_at DESC, reports.id DESC`);
  const rows = role === 'citizen' ? statement.all(userId) : statement.all();
  return rows.map((row) => ({
    ...row,
    fileName: row.imagePath ? row.imagePath.split(/[\\/]/).pop() : '',
    imageUrl: row.imagePath ? `/${row.imagePath.replace(/\\/g, '/')}` : '',
  }));
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
    return true;
  });
  if (!update()) return null;
  return getReportById({ id, role: 'authority' });
};

const updateReportStatus = async ({ id, ngoId, status, note }) => {
  const update = db.transaction(() => {
    const report = db.prepare(`
      SELECT status FROM reports WHERE id = ? AND accepted_by_ngo_id = ?
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
    return true;
  });
  if (!update()) return null;
  return getReportById({ id, role: 'authority' });
};

const verifyReport = async ({ id, ngoId, ngoType }) => {
  const update = db.transaction(() => {
    const report = db.prepare(`
      SELECT id, category, location_id, description, ai_severity AS aiSeverity, verified
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
    return true;
  });
  if (!update()) return null;
  return getReportById({ id, role: 'authority' });
};

module.exports = {
  createReport,
  getReports,
  getReportById,
  acceptReport,
  updateReportStatus,
  verifyReport,
  seedDemoReports,
};
