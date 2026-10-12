const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'urbanpulse-batch-d-'));
process.env.DB_PATH = path.join(testDirectory, 'test.db');
process.env.SEED_DEMO_DATA = 'false';

const { db } = require('./index');
const locations = require('./locations');
const { getImpactReport } = require('./impact');

let userIndex = 0;
const makeUser = (name, role, extra = {}) => {
  userIndex += 1;
  return db.prepare(`
    INSERT INTO users (full_name, organization_name, email, password_hash, role, ngo_type, status)
    VALUES (?, ?, ?, 'test', ?, ?, 'active')
  `).run(name, extra.organizationName || null, `batch-d-${userIndex}@example.test`, role, extra.ngoType || null).lastInsertRowid;
};

const makeLocation = (name = 'Batch D Test Park') => {
  db.prepare(`
    INSERT OR IGNORE INTO locations (name, latitude, longitude) VALUES (?, 13.05, 80.25)
  `).run(name);
  return db.prepare('SELECT id FROM locations WHERE name = ?').get(name).id;
};

test('updates a location score snapshot instead of creating another row on the same day', async () => {
  const citizenId = makeUser('Snapshot Citizen', 'citizen');
  const locationId = makeLocation('Batch D Seed History Park');
  db.prepare(`
    INSERT INTO ratings (citizen_id, location_id, cleanliness, safety, lighting, accessibility, seating, shade, water_availability)
    VALUES (?, ?, 3, 3, 3, 3, 3, 3, 3)
  `).run(citizenId, locationId);

  const date = '2026-02-14';
  const firstSnapshotId = locations.saveScoreSnapshot(locationId, date);
  const firstOverall = db.prepare('SELECT overall FROM score_snapshots WHERE id = ?').get(firstSnapshotId).overall;
  db.prepare('UPDATE ratings SET cleanliness = 5 WHERE citizen_id = ? AND location_id = ?').run(citizenId, locationId);
  const secondSnapshotId = locations.saveScoreSnapshot(locationId, date);
  const dayRows = db.prepare(`
    SELECT COUNT(*) AS count FROM score_snapshots
    WHERE location_id = ? AND date(created_at) = ?
  `).get(locationId, date).count;
  const updatedOverall = db.prepare('SELECT overall FROM score_snapshots WHERE id = ?').get(secondSnapshotId).overall;

  assert.equal(secondSnapshotId, firstSnapshotId);
  assert.equal(dayRows, 1);
  assert.ok(updatedOverall > firstOverall);
});

test('seeds eight weeks of demo history idempotently', async () => {
  const locationId = makeLocation('Batch D Seed History Only');
  await locations.seedDemoScoreHistory();
  const history = await locations.getScoreHistory({ locationId, days: 90 });
  const firstCount = db.prepare(`
    SELECT COUNT(*) AS count FROM score_snapshots WHERE location_id = ?
  `).get(locationId).count;
  await locations.seedDemoScoreHistory();
  const secondCount = db.prepare(`
    SELECT COUNT(*) AS count FROM score_snapshots WHERE location_id = ?
  `).get(locationId).count;

  assert.equal(firstCount, 56);
  assert.equal(secondCount, 56);
  assert.equal(history.snapshots.length, 56);
});

test('captures the NGO monthly impact figures, top places, and resolved photo gallery', () => {
  const ngoId = makeUser('Impact NGO', 'ngo', {
    organizationName: 'Green Chennai NGO',
    ngoType: 'Waste Management',
  });
  const citizenId = makeUser('Impact Reporter', 'citizen');
  const locationId = makeLocation();
  const month = new Date().toISOString().slice(0, 7);
  const createdAt = `${month}-05 08:00:00`;
  const resolvedId = db.prepare(`
    INSERT INTO reports (
      citizen_id, location_id, location_name, title, category, description, image_path,
      after_image_path, status, accepted_by_ngo_id, verified, created_at
    ) VALUES (?, ?, 'Batch D Test Park', 'Cleared illegal dumping', 'Waste Management',
      'Waste piled beside the park.', 'uploads/before.jpg', 'uploads/after.jpg',
      'resolved', ?, 1, ?)
  `).run(citizenId, locationId, ngoId, createdAt).lastInsertRowid;
  const pendingId = db.prepare(`
    INSERT INTO reports (
      citizen_id, location_id, location_name, title, category, description, image_path,
      status, created_at
    ) VALUES (?, ?, 'Batch D Test Park', 'Overflowing bin', 'Waste Management',
      'Bin is full.', 'uploads/pending.jpg', 'pending', ?)
  `).run(citizenId, locationId, createdAt).lastInsertRowid;
  db.prepare(`
    INSERT INTO report_updates (report_id, actor_id, from_status, to_status, note, created_at)
    VALUES (?, ?, 'in_progress', 'resolved', 'Completed', ?)
  `).run(resolvedId, ngoId, `${month}-05 20:00:00`);

  const impact = getImpactReport({
    user: { id: ngoId, role: 'ngo', ngo_type: 'Waste Management', organization_name: 'Green Chennai NGO', full_name: 'Impact NGO' },
    month,
  });
  assert.deepEqual(impact.summary, {
    found: 2,
    accepted: 1,
    verified: 1,
    resolved: 1,
    pending: 1,
    averageResolutionHours: 12,
  });
  assert.equal(impact.ngoName, 'Green Chennai NGO');
  assert.equal(impact.topPlaces[0].location, 'Batch D Test Park');
  assert.equal(impact.resolvedGallery[0].beforeImageUrl, '/uploads/before.jpg');
  assert.equal(impact.resolvedGallery[0].afterImageUrl, '/uploads/after.jpg');

  assert.equal(db.prepare('SELECT id FROM reports WHERE id = ?').get(pendingId).id, pendingId);
});

test.after(() => {
  db.close();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});
