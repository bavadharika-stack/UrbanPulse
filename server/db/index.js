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
  `);
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
    availability: row.role === 'ngo' ? 'available' : undefined,
    createdAt: row.created_at,
  };
};

const findUserByEmail = async (email) =>
  db.prepare(`
    SELECT id, full_name, organization_name, email, password_hash, role, ngo_type, created_at
    FROM users WHERE email = ?
  `).get(email) || null;

const findUserById = async (id) => {
  const row = db.prepare(`
    SELECT id, full_name, organization_name, email, role, ngo_type, created_at
    FROM users WHERE id = ?
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

  const insertDemoAccounts = db.transaction((accounts) => {
    for (const account of accounts) insertIfMissing.run(account);
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

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  seedDemoAccounts,
  db,
};
