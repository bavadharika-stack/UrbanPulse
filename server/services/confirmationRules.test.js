const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getConfirmationEscalationLevel,
  getConfirmationError,
  requiresAfterPhoto,
} = require('./confirmationRules');

test('rejects confirmation of your own report and repeated confirmations', () => {
  assert.equal(getConfirmationError({ reportCitizenId: 4, citizenId: 4 }), 'OWN_REPORT');
  assert.equal(getConfirmationError({ reportCitizenId: 3, citizenId: 4, alreadyConfirmed: true }), 'ALREADY_CONFIRMED');
  assert.equal(getConfirmationError({ reportCitizenId: 3, citizenId: 4, alreadyConfirmed: false }), null);
});

test('confirmation thresholds escalate priority once at three and again at ten', () => {
  assert.equal(getConfirmationEscalationLevel(0), 0);
  assert.equal(getConfirmationEscalationLevel(2), 0);
  assert.equal(getConfirmationEscalationLevel(3), 1);
  assert.equal(getConfirmationEscalationLevel(9), 1);
  assert.equal(getConfirmationEscalationLevel(10), 2);
});

test('resolving an NGO report requires an after photo', () => {
  assert.equal(requiresAfterPhoto({ status: 'in_progress' }), false);
  assert.equal(requiresAfterPhoto({ status: 'resolved' }), true);
});
