const express = require('express');
const { db } = require('../db/init');
const { requireAdminAuth } = require('../middleware/adminAuth');

const router = express.Router();

// 公開：取得相簿列表（含封面：該相簿第一張照片）
router.get('/', async (req, res) => {
  const albums = await db.prepare('SELECT * FROM albums ORDER BY sort_order ASC, id ASC').all();
  const covers = await db.prepare(`
    SELECT gi.album_id, gi.image_url
    FROM gallery_items gi
    INNER JOIN (
      SELECT album_id, MIN(id) AS min_id
      FROM gallery_items
      GROUP BY album_id
    ) first ON first.album_id = gi.album_id AND first.min_id = gi.id
  `).all();
  const coverByAlbum = {};
  for (const c of covers) coverByAlbum[c.album_id] = c.image_url;

  res.json(albums.map(a => ({ ...a, cover_url: coverByAlbum[a.id] || null })));
});

// 後台：新增相簿
router.post('/', requireAdminAuth, async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '請輸入相簿名稱' });
  }

  const countRow = await db.prepare('SELECT COUNT(*) AS c FROM albums').get();
  const insertResult = await db.prepare(`
    INSERT INTO albums (name, description, sort_order)
    VALUES (?, ?, ?)
  `).run(name.trim(), description ? description.trim() : null, countRow.c);

  const album = await db.prepare('SELECT * FROM albums WHERE id = ?').get(insertResult.lastInsertRowid);
  res.status(201).json(album);
});

// 後台：編輯相簿
router.put('/:id', requireAdminAuth, async (req, res) => {
  const existing = await db.prepare('SELECT * FROM albums WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '找不到相簿' });

  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '請輸入相簿名稱' });
  }

  await db.prepare('UPDATE albums SET name = ?, description = ? WHERE id = ?')
    .run(name.trim(), description ? description.trim() : null, req.params.id);

  const album = await db.prepare('SELECT * FROM albums WHERE id = ?').get(req.params.id);
  res.json(album);
});

// 後台：刪除相簿（相簿內的照片一併刪除，避免孤兒資料）
router.delete('/:id', requireAdminAuth, async (req, res) => {
  const existing = await db.prepare('SELECT * FROM albums WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '找不到相簿' });

  await db.prepare('DELETE FROM gallery_items WHERE album_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM albums WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
