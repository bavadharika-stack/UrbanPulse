const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'urbanpulse-batch-c-'));
process.env.DB_PATH = path.join(testDirectory, 'test.db');
process.env.SEED_DEMO_DATA = 'false';

const { db } = require('./index');
const reports = require('./reports');
const engagement = require('./engagement');

let userIndex = 0;
const makeCitizen = (name = 'Batch C Citizen', role = 'citizen') => {
  userIndex += 1;
  return db.prepare(`
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES (?, ?, 'test', ?)
  `).run(name, `batch-c-${userIndex}@example.test`, role).lastInsertRowid;
};

const makeReport = ({
  citizenId,
  location = 'Batch C Place',
  title = 'Broken streetlight near school',
  category = 'Public Safety',
  description = 'The streetlight is not working and the road is dark at night.',
  status = 'pending',
  acceptedByNgoId = null,
}) => {
  db.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)').run(location);
  const locationId = db.prepare('SELECT id FROM locations WHERE name = ?').get(location).id;
  return db.prepare(`
    INSERT INTO reports (
      citizen_id, location_id, location_name, title, category, description, image_path,
      status, priority, accepted_by_ngo_id
    )
    VALUES (?, ?, ?, ?, ?, ?, 'uploads/before.jpg', ?, 'low', ?)
  `).run(citizenId, locationId, location, title, category, description, status, acceptedByNgoId).lastInsertRowid;
};

test('detects likely duplicates and creates grouped reports only when explicitly allowed', async () => {
  const reporterId = makeCitizen('First reporter');
  const secondReporterId = makeCitizen('Second reporter');
  const firstId = makeReport({ citizenId: reporterId, location: 'Duplicate Test Road' });
  const reportInput = {
    citizenId: secondReporterId,
    location: 'Duplicate Test Road',
    title: 'Streetlight not working',
    category: 'Public Safety',
    description: 'The road near school stays dark at night.',
    imagePath: 'uploads/second.jpg',
    aiAnalysis: {
      category: 'Public Safety',
      severity: 'high',
      sentiment: 'negative',
      department: 'Public Safety Department',
      provider: 'rules',
    },
  };

  await assert.rejects(reports.createReport(reportInput), {
    code: 'REPORT_POSSIBLE_DUPLICATE',
  });
  const created = await reports.createReport({ ...reportInput, allowDuplicate: true });

  assert.equal(created.groupReportCount, 2);
  assert.equal(created.issueGroupId, firstId);
  const firstReport = await reports.getReportById({ id: firstId, role: 'authority' });
  assert.equal(firstReport.groupReportCount, 2);
});

test('confirms another citizen report once, raises priority at thresholds, and notifies the reporter', async () => {
  const reporterId = makeCitizen('Confirmation target');
  const reportId = makeReport({ citizenId: reporterId, location: 'Confirmation Test Road' });
  const citizenIds = Array.from({ length: 10 }, (_, index) => makeCitizen(`Confirmer ${index + 1}`));

  await assert.rejects(
    reports.confirmReport({ id: reportId, citizenId: reporterId }),
    { code: 'OWN_REPORT' },
  );
  assert.equal((await reports.confirmReport({ id: reportId, citizenId: citizenIds[0] })).priority, 'low');
  await assert.rejects(
    reports.confirmReport({ id: reportId, citizenId: citizenIds[0] }),
    { code: 'ALREADY_CONFIRMED' },
  );
  await reports.confirmReport({ id: reportId, citizenId: citizenIds[1] });
  assert.equal((await reports.confirmReport({ id: reportId, citizenId: citizenIds[2] })).priority, 'medium');
  for (const citizenId of citizenIds.slice(3)) {
    const result = await reports.confirmReport({ id: reportId, citizenId });
    if (result.confirmationCount === 10) assert.equal(result.priority, 'high');
  }

  const community = await reports.getReports({
    userId: citizenIds[0],
    role: 'citizen',
    scope: 'community',
    page: 1,
    pageSize: 20,
  });
  const confirmedReport = community.reports.find((report) => report.id === reportId);
  assert.equal(confirmedReport.confirmedByMe, true);
  assert.equal(confirmedReport.confirmationCount, 10);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM confirmations WHERE report_id = ?').get(reportId).count, 10);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND report_id = ?')
    .get(reporterId, reportId).count, 10);
});

test('rejects NGO resolution without an after photo and stores/notifies when the photo is supplied', async () => {
  const reporterId = makeCitizen('Resolution reporter');
  const ngoId = makeCitizen('Resolution NGO', 'ngo');
  const reportId = makeReport({
    citizenId: reporterId,
    location: 'Resolution Test Road',
    status: 'in_progress',
    acceptedByNgoId: ngoId,
  });

  await assert.rejects(
    reports.updateReportStatus({ id: reportId, ngoId, status: 'resolved', note: '' }),
    { code: 'AFTER_PHOTO_REQUIRED' },
  );
  const resolved = await reports.updateReportStatus({
    id: reportId,
    ngoId,
    status: 'resolved',
    note: 'Repairs completed',
    afterImagePath: 'uploads/after.webp',
  });

  assert.equal(resolved.afterImageUrl, '/uploads/after.webp');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND report_id = ?')
    .get(reporterId, reportId).count, 2);
  const history = await reports.getReportHistory({ id: reportId, role: 'authority' });
  assert.ok(history.some((event) => event.eventType === 'after_photo_added'));
});

test.after(() => {
  db.close();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});
