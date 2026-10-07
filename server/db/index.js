const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const dbPath = config.databasePath;
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

// Enable WAL mode for better concurrency & performance
db.pragma('journal_mode = WAL');

// Initialize database schema
const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'citizen',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

initDb();

const findUserByEmail = async (email) =>
  db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);

const createCitizenUser = async ({ fullName, email, passwordHash }) => {
  const result = db.prepare(`
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES (?, ?, ?, 'citizen')
  `).run(fullName, email, passwordHash);

  return db.prepare(`
    SELECT id, full_name as fullName, email, role, created_at as createdAt
    FROM users WHERE id = ?
  `).get(result.lastInsertRowid);
};

module.exports = {
  findUserByEmail,
  createCitizenUser,
};
