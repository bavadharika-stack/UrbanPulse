const { db } = require('./index');
const { scoreLocation } = require('../services/scoreEngine');
const { canAddPlaceToday, findDuplicatePlace } = require('../services/placeRules');

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
    SELECT location_id AS locationId, category, status, verified
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
  const result = db.prepare(`
    INSERT INTO ratings (${columns.join(', ')}) VALUES (${placeholders})
  `).run(...values);
  return db.prepare(`
    SELECT id, citizen_id AS citizenId, location_id AS locationId,
      cleanliness, safety, lighting, accessibility, seating, shade,
      water_availability AS waterAvailability, comment, created_at AS createdAt
    FROM ratings WHERE id = ?
  `).get(result.lastInsertRowid);
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

const updatePlaceStatus = async ({ locationId, status }) => {
  const result = db.prepare(`
    UPDATE locations SET status = ?
    WHERE id = ? AND is_user_added = 1
  `).run(status, locationId);
  if (!result.changes) return null;
  return db.prepare(`${LOCATION_FIELDS} WHERE id = ?`).get(locationId);
};

module.exports = {
  createRating,
  createPlace,
  getLocations,
  getUserAddedLocations,
  getScoreByLocation,
  getScores,
  seedChennaiPlaces,
  seedDemoRatings,
  updatePlaceStatus,
};
