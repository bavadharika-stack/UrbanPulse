const DAILY_REPORT_LIMIT = 10;
const DAILY_RATING_LIMIT = 20;

const isDailyLimitReached = (count, limit) => count >= limit;
const hasRolePermission = (user, roles) => Boolean(user && roles.includes(user.role));
const getLoginRoleMismatchMessage = (accountRole, selectedRole) => {
  if (!selectedRole || accountRole === selectedRole) return null;
  const roleNames = {
    citizen: 'Citizen',
    ngo: 'NGO',
    authority: 'Authority',
    admin: 'Admin',
  };
  return `This account is registered for the ${roleNames[accountRole] || accountRole} portal. Select ${roleNames[accountRole] || accountRole} to sign in.`;
};

const canPerformReportAction = ({ role, status = 'active' }, action) => {
  if (role === 'admin') return action === 'moderate' || action === 'audit';
  if (role === 'authority' && status === 'active') {
    return ['assign', 'priority', 'respond', 'resolve', 'flag', 'audit'].includes(action);
  }
  if (role === 'ngo' && status === 'active') {
    return ['accept', 'verify', 'progress', 'flag'].includes(action);
  }
  return false;
};

module.exports = {
  DAILY_REPORT_LIMIT,
  DAILY_RATING_LIMIT,
  isDailyLimitReached,
  hasRolePermission,
  getLoginRoleMismatchMessage,
  canPerformReportAction,
};
