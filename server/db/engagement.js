const { db } = require('./index');
const { notificationForReportEvent } = require('../services/notificationRules');

const recordAudit = ({ actorId, action, recordType, recordId, details = '' }) => {
  db.prepare(`
    INSERT INTO audit_log (actor_id, action, record_type, record_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(actorId, action, recordType, recordId, details);
};

const recordReportEvent = ({ reportId, actorId, eventType, details = '', isPublic = false }) => {
  db.prepare(`
    INSERT INTO report_events (report_id, actor_id, event_type, details, is_public)
    VALUES (?, ?, ?, ?, ?)
  `).run(reportId, actorId, eventType, details, isPublic ? 1 : 0);
};

const notifyUser = ({ userId, reportId = null, eventType, reportTitle }) => {
  const notification = notificationForReportEvent({ eventType, reportTitle });
  if (!notification || !userId) return;
  db.prepare(`
    INSERT INTO notifications (user_id, report_id, title, message)
    VALUES (?, ?, ?, ?)
  `).run(userId, reportId, notification.title, notification.message);
};

const getNotifications = ({ userId, page = 1, pageSize = 20 }) => {
  const total = db.prepare('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?').get(userId).total;
  const notifications = db.prepare(`
    SELECT id, report_id AS reportId, title, message, is_read AS isRead, created_at AS createdAt
    FROM notifications WHERE user_id = ?
    ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
  `).all(userId, pageSize, (page - 1) * pageSize);
  const unreadCount = db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(userId).count;
  return { notifications, unreadCount, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
};

const markNotificationRead = ({ userId, notificationId }) => {
  const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(notificationId, userId);
  return result.changes > 0;
};

const getAuditLog = ({ page = 1, pageSize = 30, action = '', recordType = '', q = '' }) => {
  const conditions = [];
  const params = [];
  if (action) { conditions.push('audit_log.action = ?'); params.push(action); }
  if (recordType) { conditions.push('audit_log.record_type = ?'); params.push(recordType); }
  if (q) {
    conditions.push('(users.email LIKE ? OR users.full_name LIKE ? OR audit_log.details LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = db.prepare(`
    SELECT COUNT(*) AS total FROM audit_log JOIN users ON users.id = audit_log.actor_id ${where}
  `).get(...params).total;
  const rows = db.prepare(`
    SELECT audit_log.id, audit_log.actor_id AS actorId, users.full_name AS actorName,
      users.email AS actorEmail, audit_log.action, audit_log.record_type AS recordType,
      audit_log.record_id AS recordId, audit_log.details, audit_log.created_at AS createdAt
    FROM audit_log JOIN users ON users.id = audit_log.actor_id ${where}
    ORDER BY audit_log.created_at DESC, audit_log.id DESC LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize);
  return { entries: rows, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
};

module.exports = {
  recordAudit,
  recordReportEvent,
  notifyUser,
  getNotifications,
  markNotificationRead,
  getAuditLog,
};
