const { db } = require('./index');

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
        (citizen_id, location_id, location_name, title, category, description, image_path, status)
      VALUES (?, ?, ?, ?, ?, ?, '', ?)
    `);
    const insertUpdate = db.prepare(`
      INSERT INTO report_updates (report_id, actor_id, from_status, to_status, note)
      VALUES (?, ?, NULL, ?, 'Demo report')
    `);

    for (const sample of samples) {
      const location = insertLocation.get(sample.location);
      const report = insertReport.run(
        citizenId,
        location.id,
        sample.location,
        sample.title,
        sample.category,
        sample.description,
        sample.status,
      );
      insertUpdate.run(report.lastInsertRowid, citizenId, sample.status);
    }
  });
  seed();
};

const createReport = async ({ citizenId, location, title, category, description, imagePath }) => {
  const save = db.transaction(() => {
    const locationRow = db.prepare(`
      INSERT INTO locations (name) VALUES (?)
      ON CONFLICT(name) DO UPDATE SET name = excluded.name
      RETURNING id
    `).get(location);

    const result = db.prepare(`
      INSERT INTO reports
        (citizen_id, location_id, location_name, title, category, description, image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(citizenId, locationRow.id, location, title, category, description, imagePath);

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

const acceptReport = async ({ id, ngoId, organizationName }) => {
  const update = db.transaction(() => {
    const report = db.prepare(`${reportSelect} WHERE reports.id = ?`).get(id);
    if (!report || report.status !== 'pending') return null;
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

module.exports = {
  createReport,
  getReports,
  getReportById,
  acceptReport,
  updateReportStatus,
  seedDemoReports,
};
