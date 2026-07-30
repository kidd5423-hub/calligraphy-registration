const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'data.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    schedule_text TEXT,
    capacity INTEGER,
    reg_start TEXT NOT NULL,
    reg_end TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS course_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'number', 'single', 'multiple')),
    options TEXT,
    required INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS registration_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer_value TEXT,
    FOREIGN KEY (registration_id) REFERENCES registrations(id),
    FOREIGN KEY (question_id) REFERENCES course_questions(id)
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    notify_email TEXT
  );
`);

db.prepare('INSERT OR IGNORE INTO app_settings (id, notify_email) VALUES (1, NULL)').run();

module.exports = db;
