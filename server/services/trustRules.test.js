const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DAILY_RATING_LIMIT,
  DAILY_REPORT_LIMIT,
  canPerformReportAction,
  getLoginRoleMismatchMessage,
  hasRolePermission,
  isDailyLimitReached,
} = require('./trustRules');

test('limits citizen report and rating submissions per day', () => {
  assert.equal(DAILY_REPORT_LIMIT, 10);
  assert.equal(DAILY_RATING_LIMIT, 20);
  assert.equal(isDailyLimitReached(9, DAILY_REPORT_LIMIT), false);
  assert.equal(isDailyLimitReached(10, DAILY_REPORT_LIMIT), true);
  assert.equal(isDailyLimitReached(19, DAILY_RATING_LIMIT), false);
  assert.equal(isDailyLimitReached(20, DAILY_RATING_LIMIT), true);
});

test('allows actions only for the intended active roles', () => {
  assert.equal(canPerformReportAction({ role: 'authority', status: 'active' }, 'resolve'), true);
  assert.equal(canPerformReportAction({ role: 'ngo', status: 'active' }, 'verify'), true);
  assert.equal(canPerformReportAction({ role: 'ngo', status: 'pending' }, 'accept'), false);
  assert.equal(canPerformReportAction({ role: 'citizen', status: 'active' }, 'resolve'), false);
  assert.equal(canPerformReportAction({ role: 'admin', status: 'active' }, 'audit'), true);
  assert.equal(hasRolePermission({ role: 'admin' }, ['admin']), true);
  assert.equal(hasRolePermission({ role: 'ngo' }, ['authority']), false);
});

test('matches sign-in portal selection to the account role', () => {
  assert.equal(getLoginRoleMismatchMessage('authority', 'authority'), null);
  assert.equal(getLoginRoleMismatchMessage('authority', undefined), null);
  assert.equal(
    getLoginRoleMismatchMessage('authority', 'ngo'),
    'This account is registered for the Authority portal. Select Authority to sign in.',
  );
});
