const express = require('express');
const { db } = require('../db/init');
const { requireAdminAuth } = require('../middleware/adminAuth');

const router = express.Router();

router.get('/', requireAdminAuth, async (req, res) => {
  const row = await db.prepare('SELECT notify_email, site_title FROM app_settings WHERE id = 1').get();
  res.json(row);
});

router.put('/', requireAdminAuth, async (req, res) => {
  const { notify_email, site_title } = req.body;
  if (notify_email && typeof notify_email !== 'string') {
    return res.status(400).json({ error: 'notify_email 必須是字串' });
  }
  if (site_title && typeof site_title !== 'string') {
    return res.status(400).json({ error: 'site_title 必須是字串' });
  }
  await db.prepare('UPDATE app_settings SET notify_email = ?, site_title = ? WHERE id = 1').run(
    notify_email ? notify_email.trim() : null,
    site_title ? site_title.trim() : null
  );
  const row = await db.prepare('SELECT notify_email, site_title FROM app_settings WHERE id = 1').get();
  res.json(row);
});

// 公開：只回傳網站名稱，供前台頁面顯示，不含通知信箱等敏感設定
router.get('/site-info', async (req, res) => {
  const row = await db.prepare('SELECT site_title FROM app_settings WHERE id = 1').get();
  res.json({ site_title: row.site_title || '書法班報名系統' });
});

module.exports = router;
