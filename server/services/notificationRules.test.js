const test = require('node:test');
const assert = require('node:assert/strict');
const { notificationForReportEvent } = require('./notificationRules');

test('builds user-facing notifications for report lifecycle, account activation, and NGO decisions', () => {
  for (const eventType of [
    'accepted', 'verified', 'status_changed', 'authority_response', 'resolved',
    'report_confirmed', 'after_photo_added', 'ngo_approved', 'ngo_rejected', 'account_activated',
  ]) {
    const notification = notificationForReportEvent({ eventType, reportTitle: 'Broken streetlight' });
    assert.ok(notification.title);
    assert.ok(notification.message);
  }
  assert.match(notificationForReportEvent({ eventType: 'account_activated' }).message, /reactivated/);
  assert.match(notificationForReportEvent({ eventType: 'resolved', reportTitle: 'Broken streetlight' }).message, /Broken streetlight/);
  assert.match(notificationForReportEvent({ eventType: 'report_confirmed', reportTitle: 'Broken streetlight' }).message, /confirmed/);
  assert.match(notificationForReportEvent({ eventType: 'after_photo_added', reportTitle: 'Broken streetlight' }).message, /after photo/);
  assert.equal(notificationForReportEvent({ eventType: 'unknown' }), null);
});
