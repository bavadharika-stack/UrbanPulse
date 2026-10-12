const { db } = require('./index');
const { summarizeImpact } = require('../services/impactRules');

const getImpactReport = ({
  user,
  month,
  category = '',
  area = '',
  ngoId = null,
}) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = `${month}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 1));
  const end = endDate.toISOString().slice(0, 10);
  const conditions = ['reports.created_at >= ?', 'reports.created_at < ?'];
  const parameters = [start, end];

  if (category) {
    conditions.push('reports.category = ?');
    parameters.push(category);
  }
  if (area) {
    conditions.push('reports.location_name LIKE ?');
    parameters.push(`%${area}%`);
  }
  let ngoName = user.organization_name || user.full_name;
  if (user.role === 'ngo') {
    if (category && category !== user.ngo_type) {
      const error = new Error('NGO impact reports are limited to your registered category.');
      error.code = 'IMPACT_CATEGORY_FORBIDDEN';
      throw error;
    }
    conditions.push('reports.category = ?');
    parameters.push(user.ngo_type);
    conditions.push(`(
      reports.status = 'pending'
      OR reports.accepted_by_ngo_id = ?
      OR reports.verified_by_ngo_id = ?
    )`);
    parameters.push(user.id, user.id);
  } else if (ngoId) {
    conditions.push(`(
      reports.accepted_by_ngo_id = ?
      OR reports.verified_by_ngo_id = ?
      OR reports.status = 'pending'
    )`);
    parameters.push(ngoId, ngoId);
    const ngo = db.prepare(`
      SELECT COALESCE(organization_name, full_name) AS name
      FROM users WHERE id = ? AND role = 'ngo'
    `).get(ngoId);
    if (!ngo) {
      const error = new Error('Selected NGO was not found.');
      error.code = 'IMPACT_NGO_NOT_FOUND';
      throw error;
    }
    ngoName = ngo.name;
  } else {
    ngoName = 'All NGOs';
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const rows = db.prepare(`
    SELECT reports.id, reports.title, reports.category, reports.location_name AS location,
      reports.status, reports.accepted_by_ngo_id AS acceptedByNgoId,
      reports.verified, reports.created_at AS createdAt,
      (SELECT MIN(report_updates.created_at)
        FROM report_updates
        WHERE report_updates.report_id = reports.id AND report_updates.to_status = 'resolved'
      ) AS resolvedAt,
      reports.image_path AS imagePath,
      reports.after_image_path AS afterImagePath,
      reports.priority
    FROM reports
    ${where}
    ORDER BY reports.created_at DESC, reports.id DESC
  `).all(...parameters);
  const summary = summarizeImpact(rows);
  const topPlaces = db.prepare(`
    SELECT reports.location_name AS location, COUNT(*) AS reportCount
    FROM reports ${where}
    GROUP BY reports.location_id, reports.location_name
    ORDER BY reportCount DESC, location ASC
    LIMIT 5
  `).all(...parameters);
  const resolvedGallery = rows
    .filter((report) => report.status === 'resolved' && report.afterImagePath)
    .slice(0, 12)
    .map((report) => ({
      id: report.id,
      title: report.title,
      location: report.location,
      beforeImageUrl: report.imagePath ? `/${report.imagePath.replace(/\\/g, '/')}` : '',
      afterImageUrl: `/${report.afterImagePath.replace(/\\/g, '/')}`,
    }));

  return {
    month,
    dateRange: { start, end: new Date(endDate.getTime() - 86400000).toISOString().slice(0, 10) },
    ngoName,
    category: category || (user.role === 'ngo' ? user.ngo_type : ''),
    area,
    summary,
    topPlaces,
    resolvedGallery,
    availableNgos: ['authority', 'admin'].includes(user.role)
      ? db.prepare(`
        SELECT id, COALESCE(organization_name, full_name) AS name
        FROM users WHERE role = 'ngo' AND status = 'active'
        ORDER BY name
      `).all()
      : [],
  };
};

module.exports = { getImpactReport };
