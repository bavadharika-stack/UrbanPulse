const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'urbanpulse-batch-b-'));
const databasePath = path.join(testDirectory, 'test.db');
process.env.DB_PATH = databasePath;
process.env.SEED_DEMO_DATA = 'false';

const config = require('../config');
const userRepository = require('./index');
const { db } = userRepository;
const reports = require('./reports');
const locations = require('./locations');
const admin = require('./admin');
const engagement = require('./engagement');

const makeUser = (name, role, status = 'active') => db.prepare(`
  INSERT INTO users (full_name, email, password_hash, role, status)
  VALUES (?, ?, 'test', ?, ?)
`).run(name, `${name.toLowerCase()}@example.test`, role, status).lastInsertRowid;

const citizenId = makeUser('Test Citizen', 'citizen');
const authorityId = makeUser('Test Authority', 'authority');
const adminId = makeUser('Test Admin', 'admin');
const ngoId = makeUser('Pending NGO', 'ngo', 'pending');
const locationId = db.prepare("INSERT INTO locations (name) VALUES ('Test Place')").run().lastInsertRowid;

test('enforces the daily report and rating caps at the repository boundary', async () => {
  const insertReport = db.prepare(`
    INSERT INTO reports (citizen_id, location_id, location_name, title, category, description, image_path)
    VALUES (?, ?, 'Test Place', 'Seeded limit report', 'Parks', 'Test report details', '')
  `);
  for (let index = 0; index < 10; index += 1) insertReport.run(citizenId, locationId);
  await assert.rejects(
    reports.createReport({
      citizenId,
      location: 'Test Place',
      title: 'One report too many',
      category: 'Parks',
      description: 'A valid test report description.',
      imagePath: 'uploads/test.jpg',
      aiAnalysis: {},
    }),
    { code: 'REPORT_DAILY_LIMIT' },
  );

  const insertRating = db.prepare(`
    INSERT INTO ratings (citizen_id, location_id, cleanliness, safety, lighting, accessibility, seating)
    VALUES (?, ?, 3, 3, 3, 3, 3)
  `);
  for (let index = 0; index < 20; index += 1) {
    const place = db.prepare('INSERT INTO locations (name) VALUES (?)').run(`Rating cap place ${index}`);
    insertRating.run(citizenId, place.lastInsertRowid);
  }
  const nextPlace = db.prepare("INSERT INTO locations (name) VALUES ('Rating cap overflow')").run().lastInsertRowid;
  await assert.rejects(
    locations.createRating({ citizenId, locationId: nextPlace, cleanliness: 3, safety: 3, lighting: 3, accessibility: 3, seating: 3 }),
    { code: 'RATING_DAILY_LIMIT' },
  );
});

test('persists notifications, unread counts, read state, and NGO approval', () => {
  engagement.notifyUser({ userId: citizenId, eventType: 'accepted', reportTitle: 'Test report' });
  let result = engagement.getNotifications({ userId: citizenId });
  assert.equal(result.unreadCount, 1);
  assert.match(result.notifications[0].message, /Test report/);
  assert.equal(engagement.markNotificationRead({ userId: citizenId, notificationId: result.notifications[0].id }), true);
  result = engagement.getNotifications({ userId: citizenId });
  assert.equal(result.unreadCount, 0);

  const approved = admin.updateUserStatus({ actorId: adminId, userId: ngoId, status: 'active' });
  assert.equal(approved.status, 'active');
  assert.equal(engagement.getNotifications({ userId: ngoId }).unreadCount, 1);
  assert.equal(engagement.getAuditLog({ action: 'ngo_approved' }).entries.length, 1);
});

test('reactivates deactivated non-admin accounts and records the change', () => {
  const deactivatedAuthorityId = makeUser('Deactivated Authority', 'authority', 'deactivated');
  const activated = admin.updateUserStatus({
    actorId: adminId,
    userId: deactivatedAuthorityId,
    status: 'active',
  });

  assert.equal(activated.status, 'active');
  assert.equal(activated.previousStatus, 'deactivated');
  assert.equal(engagement.getAuditLog({ action: 'user_activated' }).entries.length, 1);
  assert.equal(engagement.getNotifications({ userId: deactivatedAuthorityId }).unreadCount, 1);
  assert.equal(admin.updateUserStatus({ actorId: adminId, userId: adminId, status: 'deactivated' }), null);
});

test('seeds separate portal accounts without seeding the admin when demo data is disabled', async () => {
  await userRepository.seedDemoAccounts();

  const seededRoles = db.prepare(`
    SELECT role FROM users
    WHERE email IN ('demo@urbanpulse.com', 'ngo@urbanpulse.com', 'authority@urbanpulse.com')
    ORDER BY role
  `).all().map(({ role }) => role);
  assert.deepEqual(seededRoles, ['authority', 'citizen', 'ngo']);
  assert.equal(db.prepare("SELECT 1 FROM users WHERE email = ?").get(config.adminEmail), undefined);
});

test('seeds and refreshes the admin password only when demo data seeding is enabled', async () => {
  const previous = {
    seedDemoData: config.seedDemoData,
    adminEmail: config.adminEmail,
    adminPassword: config.demoPasswords.admin,
  };
  try {
    config.seedDemoData = true;
    config.adminEmail = 'batch-b-admin@example.test';
    config.demoPasswords.admin = 'first-admin-password';
    await userRepository.seedDemoAccounts();
    let adminRecord = await userRepository.findUserByEmail(config.adminEmail);
    assert.equal(await bcrypt.compare('first-admin-password', adminRecord.password_hash), true);

    config.demoPasswords.admin = 'updated-admin-password';
    await userRepository.seedDemoAccounts();
    adminRecord = await userRepository.findUserByEmail(config.adminEmail);
    assert.equal(await bcrypt.compare('updated-admin-password', adminRecord.password_hash), true);
  } finally {
    config.seedDemoData = previous.seedDemoData;
    config.adminEmail = previous.adminEmail;
    config.demoPasswords.admin = previous.adminPassword;
  }
});

test('writes audit and report history for authority actions and notifies the citizen', async () => {
  const reportId = db.prepare(`
    INSERT INTO reports (citizen_id, location_id, location_name, title, category, description, image_path)
    VALUES (?, ?, 'Test Place', 'Authority action report', 'Parks', 'Test report details', '')
  `).run(citizenId, locationId).lastInsertRowid;
  engagement.recordReportEvent({ reportId, actorId: citizenId, eventType: 'submitted', details: 'Report submitted' });

  await reports.updateAuthorityAction({ id: reportId, actorId: authorityId, action: 'assign', department: 'Parks Department' });
  await reports.updateAuthorityAction({ id: reportId, actorId: authorityId, action: 'priority', priority: 'high', reason: 'Immediate hazard reported' });
  await reports.updateAuthorityAction({ id: reportId, actorId: authorityId, action: 'respond', response: 'The inspection is scheduled.' });
  await reports.updateAuthorityAction({ id: reportId, actorId: authorityId, action: 'resolve' });

  const history = await reports.getReportHistory({ id: reportId, role: 'authority' });
  assert.deepEqual(history.map((event) => event.eventType), [
    'resolved', 'authority_response', 'priority_changed', 'department_assigned', 'submitted',
  ]);
  assert.equal((await reports.getReportHistory({ id: reportId, userId: citizenId, role: 'citizen' })).length, 1);
  assert.equal(engagement.getNotifications({ userId: citizenId }).unreadCount, 2);
  assert.equal(engagement.getAuditLog({ recordType: 'report' }).entries.length, 4);
});

test.after(() => {
  db.close();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});
