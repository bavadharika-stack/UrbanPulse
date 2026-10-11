const { db } = require('./index');
const { recordAudit, notifyUser } = require('./engagement');

const listUsers = ({ role = '', status = '' }) => {
  const conditions = [];
  const params = [];
  if (role) { conditions.push('role = ?'); params.push(role); }
  if (status) { conditions.push('status = ?'); params.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`
    SELECT id, full_name AS fullName, email, role, organization_name AS organizationName,
      ngo_type AS ngoType, status, created_at AS createdAt
    FROM users ${where} ORDER BY created_at DESC, id DESC LIMIT 200
  `).all(...params);
};

const updateUserStatus = ({ actorId, userId, status }) => {
  const update = db.transaction(() => {
    const user = db.prepare('SELECT id, role, full_name AS fullName, status FROM users WHERE id = ?').get(userId);
    if (!user || user.role === 'admin' || user.id === actorId) return null;
    const previousStatus = user.status;
    const changed = db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
    if (!changed.changes) return null;
    const action = status === 'active'
      ? (user.role === 'ngo' && ['pending', 'rejected'].includes(previousStatus) ? 'ngo_approved' : 'user_activated')
      : status === 'rejected' ? 'ngo_rejected' : 'user_deactivated';
    recordAudit({
      actorId,
      action,
      recordType: 'user',
      recordId: userId,
      details: `${user.fullName}: ${previousStatus} → ${status}`,
    });
    if (user.role === 'ngo' && status === 'active' && ['pending', 'rejected'].includes(previousStatus)) {
      notifyUser({ userId, eventType: 'ngo_approved' });
    } else if (status === 'active' && previousStatus === 'deactivated') {
      notifyUser({ userId, eventType: 'account_activated' });
    } else if (user.role === 'ngo' && status === 'rejected') {
      notifyUser({ userId, eventType: 'ngo_rejected' });
    }
    return { ...user, previousStatus, status };
  });
  return update();
};

module.exports = { listUsers, updateUserStatus };
