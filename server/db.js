// SQLite Database Initialization & Queries
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'chronosflow.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT DEFAULT 'User',
    chronotype TEXT DEFAULT 'BALANCED',
    wake_time TEXT DEFAULT '07:30',
    sleep_time TEXT DEFAULT '23:30',
    distraction_factor REAL DEFAULT 1.25,
    learned_buffer_inflation REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_strict INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS fixed_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    location TEXT,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    allow_gap_study INTEGER DEFAULT 0,
    source TEXT DEFAULT 'MANUAL',
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    quadrant TEXT DEFAULT 'Q1',
    estimated_minutes INTEGER DEFAULT 45,
    confidence INTEGER DEFAULT 3,
    weightage INTEGER DEFAULT 3,
    materials TEXT,
    roadblock TEXT,
    steps TEXT,
    stuck_protocol TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS session_reviews (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    task_id TEXT,
    task_title TEXT NOT NULL,
    quadrant TEXT,
    status TEXT NOT NULL,
    reason_id TEXT,
    user_note TEXT,
    hour_of_day INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS fatigue_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    hour INTEGER NOT NULL,
    UNIQUE(user_id, hour)
  );
`);

// Seed default user if not exists
const defaultUserId = 'default_user';
const userRow = db.prepare('SELECT id FROM users WHERE id = ?').get(defaultUserId);

if (!userRow) {
  db.prepare(`
    INSERT INTO users (id, name, chronotype, wake_time, sleep_time, distraction_factor, learned_buffer_inflation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(defaultUserId, 'User', 'BALANCED', '07:30', '23:30', 1.25, 1.0);
}

export function resetDatabase() {
  db.exec(`
    DELETE FROM tasks;
    DELETE FROM fixed_events;
    DELETE FROM habits;
    DELETE FROM session_reviews;
    DELETE FROM fatigue_hours;
    DELETE FROM users;
  `);

  db.prepare(`
    INSERT INTO users (id, name, chronotype, wake_time, sleep_time, distraction_factor, learned_buffer_inflation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(defaultUserId, 'User', 'BALANCED', '07:30', '23:30', 1.25, 1.0);
}

