const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const dbPath = config.databasePath;
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

// Enable WAL mode for better concurrency & performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'citizen',
      organization_name TEXT,
      ngo_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const columns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
  if (!columns.includes('organization_name')) {
    db.exec('ALTER TABLE users ADD COLUMN organization_name TEXT');
  }
  if (!columns.includes('ngo_type')) {
    db.exec('ALTER TABLE users ADD COLUMN ngo_type TEXT');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      latitude REAL,
      longitude REAL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_user_added INTEGER NOT NULL DEFAULT 0 CHECK (is_user_added IN (0, 1)),
      source TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'user')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      citizen_id INTEGER NOT NULL REFERENCES users(id),
      location_id INTEGER NOT NULL REFERENCES locations(id),
      location_name TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      image_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'in_progress', 'resolved')),
      severity TEXT,
      sentiment TEXT,
      department TEXT,
      priority TEXT,
      accepted_by_ngo_id INTEGER REFERENCES users(id),
      accepted_by_org_name TEXT,
      accepted_at DATETIME,
      progress_note TEXT,
      status_updated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_reports_citizen_id ON reports(citizen_id);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);

    CREATE TABLE IF NOT EXISTS report_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      actor_id INTEGER NOT NULL REFERENCES users(id),
      from_status TEXT,
      to_status TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ngo_availability (
      ngo_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'unavailable')),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const locationColumns = db.prepare('PRAGMA table_info(locations)').all().map((column) => column.name);
  if (!locationColumns.includes('latitude')) db.exec('ALTER TABLE locations ADD COLUMN latitude REAL');
  if (!locationColumns.includes('longitude')) db.exec('ALTER TABLE locations ADD COLUMN longitude REAL');
  if (!locationColumns.includes('created_by')) {
    db.exec('ALTER TABLE locations ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
  }
  if (!locationColumns.includes('is_user_added')) {
    db.exec('ALTER TABLE locations ADD COLUMN is_user_added INTEGER NOT NULL DEFAULT 0 CHECK (is_user_added IN (0, 1))');
  }
  if (!locationColumns.includes('source')) {
    db.exec("ALTER TABLE locations ADD COLUMN source TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'user'))");
  }
  if (!locationColumns.includes('status')) {
    db.exec("ALTER TABLE locations ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden'))");
  }
  if (!locationColumns.includes('address')) db.exec('ALTER TABLE locations ADD COLUMN address TEXT');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status);
    CREATE INDEX IF NOT EXISTS idx_locations_creator_created ON locations(created_by, created_at);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      citizen_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      cleanliness INTEGER NOT NULL CHECK (cleanliness BETWEEN 1 AND 5),
      safety INTEGER NOT NULL CHECK (safety BETWEEN 1 AND 5),
      lighting INTEGER NOT NULL CHECK (lighting BETWEEN 1 AND 5),
      accessibility INTEGER NOT NULL CHECK (accessibility BETWEEN 1 AND 5),
      seating INTEGER NOT NULL CHECK (seating BETWEEN 1 AND 5),
      shade INTEGER CHECK (shade BETWEEN 1 AND 5),
      water_availability INTEGER CHECK (water_availability BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_citizen_location_day
      ON ratings (citizen_id, location_id, date(created_at));
    CREATE INDEX IF NOT EXISTS idx_ratings_location_id ON ratings(location_id);
  `);

  const reportColumns = db.prepare('PRAGMA table_info(reports)').all().map((column) => column.name);
  if (!reportColumns.includes('verified')) {
    db.exec('ALTER TABLE reports ADD COLUMN verified INTEGER NOT NULL DEFAULT 0');
  }
  if (!reportColumns.includes('verified_by_ngo_id')) {
    db.exec('ALTER TABLE reports ADD COLUMN verified_by_ngo_id INTEGER REFERENCES users(id)');
  }
  if (!reportColumns.includes('verified_at')) {
    db.exec('ALTER TABLE reports ADD COLUMN verified_at DATETIME');
  }
  const aiColumns = db.prepare('PRAGMA table_info(reports)').all().map((column) => column.name);
  if (!aiColumns.includes('ai_category')) db.exec('ALTER TABLE reports ADD COLUMN ai_category TEXT');
  if (!aiColumns.includes('ai_severity')) db.exec('ALTER TABLE reports ADD COLUMN ai_severity TEXT');
  if (!aiColumns.includes('ai_sentiment')) db.exec('ALTER TABLE reports ADD COLUMN ai_sentiment TEXT');
  if (!aiColumns.includes('ai_department')) db.exec('ALTER TABLE reports ADD COLUMN ai_department TEXT');
  if (!aiColumns.includes('ai_provider')) db.exec('ALTER TABLE reports ADD COLUMN ai_provider TEXT');
};

initDb();

const toPublicUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    organizationName: row.organization_name || '',
    email: row.email,
    role: row.role,
    ngoType: row.ngo_type || '',
    availability: row.role === 'ngo' ? (row.availability || 'available') : undefined,
    createdAt: row.created_at,
  };
};

const findUserByEmail = async (email) =>
  db.prepare(`
    SELECT users.id, users.full_name, users.organization_name, users.email, users.password_hash,
      users.role, users.ngo_type, users.created_at, ngo_availability.status AS availability
    FROM users
    LEFT JOIN ngo_availability ON ngo_availability.ngo_id = users.id
    WHERE users.email = ?
  `).get(email) || null;

const findUserById = async (id) => {
  const row = db.prepare(`
    SELECT users.id, users.full_name, users.organization_name, users.email, users.role,
      users.ngo_type, users.created_at, ngo_availability.status AS availability
    FROM users
    LEFT JOIN ngo_availability ON ngo_availability.ngo_id = users.id
    WHERE users.id = ?
  `).get(id);
  return toPublicUser(row);
};

const createUser = async ({ fullName, organizationName = '', email, passwordHash, role, ngoType = '' }) => {
  const result = db.prepare(`
    INSERT INTO users (full_name, organization_name, email, password_hash, role, ngo_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(fullName, organizationName, email, passwordHash, role, ngoType);
  return findUserById(result.lastInsertRowid);
};

const seedDemoAccounts = async () => {
  const demoAccounts = [
    {
      fullName: 'Demo Citizen',
      email: 'demo@urbanpulse.com',
      password: config.demoPasswords.citizen,
      role: 'citizen',
    },
    {
      fullName: 'UrbanPulse NGO Demo',
      organizationName: 'UrbanPulse NGO Demo',
      email: 'ngo@urbanpulse.com',
      password: config.demoPasswords.ngo,
      role: 'ngo',
      ngoType: 'Waste Management',
    },
    {
      fullName: 'UrbanPulse Authority Demo',
      email: 'authority@urbanpulse.com',
      password: config.demoPasswords.authority,
      role: 'authority',
    },
  ];

  const insertIfMissing = db.prepare(`
    INSERT OR IGNORE INTO users
      (full_name, organization_name, email, password_hash, role, ngo_type)
    VALUES
      (@fullName, @organizationName, @email, @passwordHash, @role, @ngoType)
  `);
  const setInitialAvailability = db.prepare(`
    INSERT OR IGNORE INTO ngo_availability (ngo_id, status)
    SELECT id, 'available' FROM users WHERE email = ?
  `);

  const insertDemoAccounts = db.transaction((accounts) => {
    for (const account of accounts) insertIfMissing.run(account);
    setInitialAvailability.run('ngo@urbanpulse.com');
  });

  const accountsWithHashes = await Promise.all(demoAccounts.map(async (account) => ({
    fullName: account.fullName,
    organizationName: account.organizationName || '',
    email: account.email,
    ngoType: account.ngoType || '',
    role: account.role,
    passwordHash: await bcrypt.hash(account.password, 10),
  })));
  insertDemoAccounts(accountsWithHashes);
};

const getNgoAvailability = async (ngoId) =>
  db.prepare('SELECT status FROM ngo_availability WHERE ngo_id = ?').get(ngoId)?.status || 'available';

const setNgoAvailability = async ({ ngoId, status }) => {
  db.prepare(`
    INSERT INTO ngo_availability (ngo_id, status, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(ngo_id) DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP
  `).run(ngoId, status);
  return getNgoAvailability(ngoId);
};

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  seedDemoAccounts,
  getNgoAvailability,
  setNgoAvailability,
  db,
};
