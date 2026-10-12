const { db } = require('./index');
const { scoreLocation } = require('../services/scoreEngine');
const { canAddPlaceToday, findDuplicatePlace } = require('../services/placeRules');
const { DAILY_RATING_LIMIT, isDailyLimitReached } = require('../services/trustRules');
const { getTrendSummary, SCORE_KEYS } = require('../services/trendRules');

const CHENNAI_PLACES = [
  { name: 'Anna Nagar Park', latitude: 13.085, longitude: 80.2101 },
  { name: 'T. Nagar Bus Stop', latitude: 13.0418, longitude: 80.2337 },
  { name: 'Marina Beach Promenade', latitude: 13.05, longitude: 80.2824 },
  { name: 'Egmore Railway Station Road', latitude: 13.0782, longitude: 80.261 },
  { name: 'Adyar Bus Depot', latitude: 13.0067, longitude: 80.2565 },
  { name: 'Besant Nagar Beach', latitude: 12.9993, longitude: 80.2707 },
  { name: 'Guindy National Park Gate', latitude: 13.0067, longitude: 80.2206 },
  { name: 'Koyambedu Bus Terminus', latitude: 13.0694, longitude: 80.1948 },
  { name: 'Mylapore Tank', latitude: 13.0334, longitude: 80.2698 },
  { name: 'Velachery Public Toilet', latitude: 12.9756, longitude: 80.2207 },
];

const DEMO_RATINGS = [
  [3, 2, 2, 1, 2, 2, 2],
  [3, 3, 3, 3, 3, 3, 3],
  [5, 5, 5, 5, 5, 5, 5],
  [2, 2, 2, 2, 2, 2, 2],
  [4, 4, 4, 4, 4, 4, 4],
  [5, 5, 4, 5, 4, 5, 4],
  [4, 5, 4, 4, 4, 4, 5],
  [3, 2, 3, 3, 2, 2, 3],
  [3, 3, 3, 3, 3, 3, 3],
  [1, 2, 1, 1, 2, 1, 2],
];

const seedChennaiPlaces = async () => {
  const insertPlace = db.prepare(`
    INSERT INTO locations (name, latitude, longitude, is_user_added, source, status)
    VALUES (@name, @latitude, @longitude, 0, 'seed', 'active')
    ON CONFLICT(name) DO UPDATE SET
      latitude = excluded.latitude,
      longitude = excluded.longitude
  `);
  const insertPlaces = db.transaction((places) => places.forEach((place) => insertPlace.run(place)));
  insertPlaces(CHENNAI_PLACES);

  db.prepare(`
    UPDATE reports
    SET location_id = (
      SELECT locations.id FROM locations
      WHERE locations.name = reports.location_name COLLATE NOCASE
    )
    WHERE EXISTS (
      SELECT 1 FROM locations
      WHERE locations.name = reports.location_name COLLATE NOCASE
    )
  `).run();
};

const seedDemoRatings = async (citizenId) => {
  const existing = db.prepare(`
    SELECT 1 FROM ratings
    WHERE citizen_id = ? AND comment = 'Seeded UrbanPulse demo rating'
    LIMIT 1
  `).get(citizenId);
  if (existing) return;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO ratings
      (citizen_id, location_id, cleanliness, safety, lighting, accessibility, seating,
       shade, water_availability, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Seeded UrbanPulse demo rating', ?)
  `);
  const seed = db.transaction(() => {
    CHENNAI_PLACES.forEach((place, index) => {
      const location = db.prepare('SELECT id FROM locations WHERE name = ?').get(place.name);
      const [cleanliness, safety, lighting, accessibility, seating, shade, water] = DEMO_RATINGS[index];
      const day = String(index + 1).padStart(2, '0');
      insert.run(
        citizenId,
        location.id,
        cleanliness,
        safety,
        lighting,
        accessibility,
        seating,
        shade,
        water,
        `2026-09-${day} 12:00:00`,
      );
    });
  });
  seed();
};

const buildLocationScore = (locationId) => {
  const location = db.prepare(`${LOCATION_FIELDS} WHERE id = ?`).get(locationId);
  if (!location) return null;
  const ratings = db.prepare(`
    SELECT cleanliness, safety, lighting, accessibility, seating, shade,
      water_availability AS water_availability
    FROM ratings WHERE location_id = ?
  `).all(locationId);
  const reports = db.prepare(`
    SELECT category, status, verified, fake_flagged AS fakeFlagged
    FROM reports WHERE location_id = ?
  `).all(locationId);
  return scoreLocation({ location, ratings, reports });
};

const saveScoreSnapshot = (locationId, snapshotDate = new Date().toISOString().slice(0, 10)) => {
  const score = buildLocationScore(locationId);
  if (!score) return null;
  const snapshotAt = `${snapshotDate.slice(0, 10)} 12:00:00`;
  const existing = db.prepare(`
    SELECT id FROM score_snapshots
    WHERE location_id = ? AND date(created_at) = date(?)
  `).get(locationId, snapshotAt);
  const values = [
    score.scores.accessibility,
    score.scores.walkability,
    score.scores.safety,
    score.scores.cleanliness,
    score.scores.heatComfort,
    score.scores.overall,
    score.ratingCount,
    score.openReportCount,
  ];
  if (existing) {
    db.prepare(`
      UPDATE score_snapshots
      SET accessibility = ?, walkability = ?, safety = ?, cleanliness = ?, heat_comfort = ?,
        overall = ?, rating_count = ?, open_issue_count = ?
      WHERE id = ?
    `).run(...values, existing.id);
    return existing.id;
  }
  const inserted = db.prepare(`
    INSERT INTO score_snapshots (
      location_id, accessibility, walkability, safety, cleanliness, heat_comfort,
      overall, rating_count, open_issue_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(locationId, ...values, snapshotAt);
  return inserted.lastInsertRowid;
};

const getScoreHistory = async ({ locationId, days = 30 }) => {
  const location = db.prepare("SELECT id, name FROM locations WHERE id = ? AND status = 'active'").get(locationId);
  if (!location) return null;
  const snapshots = db.prepare(`
    SELECT accessibility, walkability, safety, cleanliness,
      heat_comfort AS heatComfort, overall, rating_count AS ratingCount,
      open_issue_count AS openIssueCount, created_at AS createdAt
    FROM score_snapshots
    WHERE location_id = ? AND date(created_at) >= date('now', ?)
    ORDER BY created_at, id
  `).all(locationId, `-${days - 1} days`);
  return {
    location,
    days,
    snapshots,
    trend: getTrendSummary(snapshots, days),
  };
};

const seedDemoScoreHistory = async () => {
  const seedSnapshot = db.prepare(`
    INSERT OR IGNORE INTO score_snapshots (
      location_id, accessibility, walkability, safety, cleanliness, heat_comfort,
      overall, rating_count, open_issue_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seed = db.transaction(() => {
    const locations = db.prepare(`
      ${LOCATION_FIELDS}
      WHERE source = 'seed' AND status = 'active'
    `).all();
    const today = new Date();
    for (const location of locations) {
      const base = buildLocationScore(location.id);
      if (!base) continue;
      for (let offset = 55; offset >= 0; offset -= 1) {
        const date = new Date(today);
        date.setUTCDate(date.getUTCDate() - offset);
        const createdAt = `${date.toISOString().slice(0, 10)} 12:00:00`;
        const drift = Math.sin((56 - offset + location.id) / 8) * 4 + ((56 - offset) / 55) * 5;
        const values = ['accessibility', 'walkability', 'safety', 'cleanliness', 'heatComfort'].map((key) => {
          const score = base.scores[key];
          return score === null ? null : Math.max(0, Math.min(100, score - 2.5 + drift));
        });
        const availableScores = values.filter((value) => value !== null);
        const overall = availableScores.length
          ? availableScores.reduce((sum, value) => sum + value, 0) / availableScores.length
          : null;
        seedSnapshot.run(
          location.id,
          ...values,
          overall,
          base.ratingCount,
          base.openReportCount,
          createdAt,
        );
      }
    }
  });
  seed();
};

const LOCATION_FIELDS = `
  SELECT id, name, latitude, longitude, address, is_user_added AS isUserAdded,
    source, status, created_at AS createdAt
  FROM locations
`;

const getLocations = async () => db.prepare(`
  ${LOCATION_FIELDS}
  WHERE status = 'active' AND latitude IS NOT NULL AND longitude IS NOT NULL
  ORDER BY name
`).all();

const getUserAddedLocations = async () => db.prepare(`
  ${LOCATION_FIELDS}
  WHERE is_user_added = 1 AND latitude IS NOT NULL AND longitude IS NOT NULL
  ORDER BY created_at DESC, id DESC
`).all();

const getScores = async () => {
  const locations = await getLocations();
  const ratings = db.prepare(`
    SELECT location_id AS locationId, cleanliness, safety, lighting, accessibility,
      seating, shade, water_availability AS water_availability
    FROM ratings
  `).all();
  const reports = db.prepare(`
    SELECT location_id AS locationId, category, status, verified, fake_flagged AS fakeFlagged
    FROM reports
  `).all();

  return locations.map((location) => scoreLocation({
    location,
    ratings: ratings.filter((rating) => rating.locationId === location.id),
    reports: reports.filter((report) => report.locationId === location.id),
  }));
};

const getScoreByLocation = async (locationId) => {
  const scores = await getScores();
  return scores.find((score) => score.id === locationId) || null;
};

const getIssueDensity = async () => db.prepare(`
  SELECT locations.latitude, locations.longitude,
    CASE reports.priority
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 0.75
      WHEN 'medium' THEN 0.5
      ELSE 0.25
    END * CASE WHEN reports.verified = 1 THEN 1.2 ELSE 1 END AS weight,
    reports.priority, reports.verified
  FROM reports
  JOIN locations ON locations.id = reports.location_id
  WHERE locations.status = 'active'
    AND locations.latitude IS NOT NULL
    AND locations.longitude IS NOT NULL
    AND reports.status IN ('pending', 'accepted', 'in_progress')
    AND reports.fake_flagged = 0
  ORDER BY weight DESC
`).all();

const createRating = async ({ citizenId, locationId, ...rating }) => {
  const columns = [
    'citizen_id', 'location_id', 'cleanliness', 'safety', 'lighting',
    'accessibility', 'seating', 'shade', 'water_availability', 'comment',
  ];
  const values = [
    citizenId, locationId, rating.cleanliness, rating.safety, rating.lighting,
    rating.accessibility, rating.seating, rating.shade ?? null,
    rating.waterAvailability ?? null, rating.comment || '',
  ];
  const placeholders = columns.map(() => '?').join(', ');
  const create = db.transaction(() => {
    const todayCount = db.prepare(`
      SELECT COUNT(*) AS count FROM ratings WHERE citizen_id = ? AND date(created_at) = date('now')
    `).get(citizenId).count;
    if (isDailyLimitReached(todayCount, DAILY_RATING_LIMIT)) {
      const limitError = new Error('Daily rating limit reached.');
      limitError.code = 'RATING_DAILY_LIMIT';
      throw limitError;
    }
    const result = db.prepare(`
      INSERT INTO ratings (${columns.join(', ')}) VALUES (${placeholders})
    `).run(...values);
    saveScoreSnapshot(locationId);
    return result.lastInsertRowid;
  });
  const ratingId = create();
  return db.prepare(`
    SELECT id, citizen_id AS citizenId, location_id AS locationId,
      cleanliness, safety, lighting, accessibility, seating, shade,
      water_availability AS waterAvailability, comment, created_at AS createdAt
    FROM ratings WHERE id = ?
  `).get(ratingId);
};

const createPlace = async ({ citizenId, name, latitude, longitude, address = '' }) => {
  const create = db.transaction(() => {
    const activeLocations = db.prepare(`
      SELECT id, name, latitude, longitude FROM locations
      WHERE status = 'active'
    `).all();
    const duplicate = findDuplicatePlace({ name, latitude, longitude }, activeLocations);
    if (duplicate) {
      if (!Number.isFinite(duplicate.latitude) || !Number.isFinite(duplicate.longitude)) {
        db.prepare(`
          UPDATE locations
          SET latitude = ?, longitude = ?, address = COALESCE(address, ?),
              created_by = COALESCE(created_by, ?), is_user_added = 1, source = 'user'
          WHERE id = ? AND status = 'active'
        `).run(latitude, longitude, address.trim() || null, citizenId, duplicate.id);
      }
      return {
        location: db.prepare(`${LOCATION_FIELDS} WHERE id = ?`).get(duplicate.id),
        created: false,
        limitReached: false,
      };
    }

    const placesCreatedToday = db.prepare(`
      SELECT COUNT(*) AS count FROM locations
      WHERE created_by = ? AND is_user_added = 1 AND date(created_at) = date('now')
    `).get(citizenId).count;
    if (!canAddPlaceToday(placesCreatedToday)) {
      return { location: null, created: false, limitReached: true };
    }

    const result = db.prepare(`
      INSERT INTO locations
        (name, latitude, longitude, address, created_by, is_user_added, source, status)
      VALUES (?, ?, ?, ?, ?, 1, 'user', 'active')
    `).run(name.trim(), latitude, longitude, address.trim() || null, citizenId);
    return {
      location: db.prepare(`${LOCATION_FIELDS} WHERE id = ?`).get(result.lastInsertRowid),
      created: true,
      limitReached: false,
    };
  });
  return create({ citizenId, name, latitude, longitude, address });
};

const updatePlaceStatus = async ({ locationId, status, actorId, allowSeeded = false }) => {
  const result = db.prepare(`
    UPDATE locations SET status = ?
    WHERE id = ? ${allowSeeded ? '' : 'AND is_user_added = 1'}
  `).run(status, locationId);
  if (!result.changes) return null;
  if (actorId) {
    const { recordAudit } = require('./engagement');
    recordAudit({
      actorId,
      action: status === 'hidden' ? 'place_hidden' : 'place_restored',
      recordType: 'location',
      recordId: locationId,
      details: `Location ${status}`,
    });
  }
  return db.prepare(`${LOCATION_FIELDS} WHERE id = ?`).get(locationId);
};

module.exports = {
  createRating,
  createPlace,
  getLocations,
  getUserAddedLocations,
  getScoreByLocation,
  getScores,
  getIssueDensity,
  getScoreHistory,
  saveScoreSnapshot,
  seedDemoScoreHistory,
  CHENNAI_PLACES,
  seedChennaiPlaces,
  seedDemoRatings,
  updatePlaceStatus,
};
