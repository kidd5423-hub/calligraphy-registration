const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { db } = require('../db/init');
const { requireAdminAuth } = require('../middleware/adminAuth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只能上傳圖片檔案'));
    }
    cb(null, true);
  },
});

function handleUpload(req, res, next) {
  upload.array('images', 20)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '檔案上傳失敗' });
    next();
  });
}

function cloudinaryConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

if (cloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'calligraphy-gallery' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// 公開：取得作品列表（可用 ?album_id= 篩選）
router.get('/', async (req, res) => {
  const { album_id } = req.query;
  const items = album_id
    ? await db.prepare('SELECT * FROM gallery_items WHERE album_id = ? ORDER BY sort_order ASC, id ASC').all(album_id)
    : await db.prepare('SELECT * FROM gallery_items ORDER BY sort_order ASC, id ASC').all();
  res.json(items);
});

// 後台：批次上傳新作品（可一次選取多張圖片）
router.post('/', requireAdminAuth, handleUpload, async (req, res) => {
  if (!cloudinaryConfigured()) {
    return res.status(400).json({ error: '伺服器尚未設定 Cloudinary，無法上傳圖片' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '請選擇要上傳的圖片' });
  }

  const { title, description, album_id } = req.body;
  if (!album_id) {
    return res.status(400).json({ error: '請選擇要放入的相簿' });
  }
  const album = await db.prepare('SELECT id FROM albums WHERE id = ?').get(album_id);
  if (!album) {
    return res.status(400).json({ error: '找不到指定的相簿' });
  }

  const countRow = await db.prepare('SELECT COUNT(*) AS c FROM gallery_items').get();
  let nextOrder = countRow.c;

  const items = [];
  for (const file of req.files) {
    let result;
    try {
      result = await uploadToCloudinary(file.buffer);
    } catch (err) {
      return res.status(500).json({ error: '圖片上傳失敗：' + err.message, uploaded: items });
    }

    const insertResult = await db.prepare(`
      INSERT INTO gallery_items (title, description, image_url, sort_order, album_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(title ? title.trim() : null, description ? description.trim() : null, result.secure_url, nextOrder, album_id);
    nextOrder += 1;

    items.push(await db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(insertResult.lastInsertRowid));
  }

  res.status(201).json(items);
});

// 後台：刪除作品
router.delete('/:id', requireAdminAuth, async (req, res) => {
  const existing = await db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '找不到作品' });

  await db.prepare('DELETE FROM gallery_items WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
