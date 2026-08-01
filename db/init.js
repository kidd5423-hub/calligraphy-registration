const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function normalizeRow(row) {
  if (row == null) return row;
  const out = {};
  for (const key of Object.keys(row)) {
    const value = row[key];
    out[key] = typeof value === 'bigint' ? Number(value) : value;
  }
  return out;
}

// 包一層跟 better-sqlite3 相同形狀的介面（prepare().get/all/run），
// 讓既有的呼叫端只需要補上 async/await，不用整段重寫。
const db = {
  prepare(sql) {
    return {
      async get(...params) {
        const res = await client.execute({ sql, args: params });
        return res.rows[0] ? normalizeRow(res.rows[0]) : undefined;
      },
      async all(...params) {
        const res = await client.execute({ sql, args: params });
        return res.rows.map(normalizeRow);
      },
      async run(...params) {
        const res = await client.execute({ sql, args: params });
        return {
          lastInsertRowid: res.lastInsertRowid != null ? Number(res.lastInsertRowid) : undefined,
          changes: res.rowsAffected,
        };
      },
    };
  },
};

async function init() {
  await client.batch([
    `CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      schedule_text TEXT,
      capacity INTEGER,
      reg_start TEXT NOT NULL,
      reg_end TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )`,
    `CREATE TABLE IF NOT EXISTS course_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('text', 'number', 'single', 'multiple')),
      options TEXT,
      required INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )`,
    `CREATE TABLE IF NOT EXISTS registration_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      answer_value TEXT,
      FOREIGN KEY (registration_id) REFERENCES registrations(id),
      FOREIGN KEY (question_id) REFERENCES course_questions(id)
    )`,
    `CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      notify_email TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS gallery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
  ], 'write');

  const settingsInfo = await client.execute('PRAGMA table_info(app_settings)');
  const settingsColumns = settingsInfo.rows.map(r => r.name);
  if (!settingsColumns.includes('site_title')) {
    await client.execute('ALTER TABLE app_settings ADD COLUMN site_title TEXT');
  }

  const registrationInfo = await client.execute('PRAGMA table_info(registrations)');
  const registrationColumns = registrationInfo.rows.map(r => r.name);
  if (!registrationColumns.includes('contact_name')) {
    await client.execute('ALTER TABLE registrations ADD COLUMN contact_name TEXT');
  }

  const galleryInfo = await client.execute('PRAGMA table_info(gallery_items)');
  const galleryColumns = galleryInfo.rows.map(r => r.name);
  if (!galleryColumns.includes('album_id')) {
    await client.execute('ALTER TABLE gallery_items ADD COLUMN album_id INTEGER REFERENCES albums(id)');
  }

  const settingsInfo2 = await client.execute('PRAGMA table_info(app_settings)');
  const settingsColumns2 = settingsInfo2.rows.map(r => r.name);
  if (!settingsColumns2.includes('new_badge_days')) {
    await client.execute('ALTER TABLE app_settings ADD COLUMN new_badge_days INTEGER');
  }

  await client.execute('INSERT OR IGNORE INTO app_settings (id, notify_email) VALUES (1, NULL)');
  await client.execute('UPDATE app_settings SET new_badge_days = 7 WHERE id = 1 AND new_badge_days IS NULL');

  // 既有沒有相簿分類的照片，自動歸進「未分類」相簿，避免消失或顯示異常
  const unfiledCountRow = await client.execute('SELECT COUNT(*) AS c FROM gallery_items WHERE album_id IS NULL');
  if (unfiledCountRow.rows[0].c > 0) {
    let unfiledAlbum = await client.execute({
      sql: 'SELECT id FROM albums WHERE name = ?',
      args: ['未分類'],
    });
    let unfiledAlbumId;
    if (unfiledAlbum.rows.length > 0) {
      unfiledAlbumId = unfiledAlbum.rows[0].id;
    } else {
      const inserted = await client.execute({
        sql: 'INSERT INTO albums (name, description) VALUES (?, ?)',
        args: ['未分類', '尚未分類的照片'],
      });
      unfiledAlbumId = inserted.lastInsertRowid;
    }
    await client.execute({
      sql: 'UPDATE gallery_items SET album_id = ? WHERE album_id IS NULL',
      args: [unfiledAlbumId],
    });
  }
}

module.exports = { db, init };
