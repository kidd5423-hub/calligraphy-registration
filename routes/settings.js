const express = require('express');
const { db } = require('../db/init');
const { requireAdminAuth } = require('../middleware/adminAuth');

const router = express.Router();

router.get('/', requireAdminAuth, async (req, res) => {
  const row = await db.prepare('SELECT notify_email, site_title, new_badge_days FROM app_settings WHERE id = 1').get();
  res.json(row);
});

router.put('/', requireAdminAuth, async (req, res) => {
  const { notify_email, site_title, new_badge_days } = req.body;
  if (notify_email && typeof notify_email !== 'string') {
    return res.status(400).json({ error: 'notify_email 必須是字串' });
  }
  if (site_title && typeof site_title !== 'string') {
    return res.status(400).json({ error: 'site_title 必須是字串' });
  }
  const badgeDays = new_badge_days === '' || new_badge_days === undefined || new_badge_days === null
    ? 7
    : Number(new_badge_days);
  if (!Number.isInteger(badgeDays) || badgeDays < 0) {
    return res.status(400).json({ error: 'New 標示顯示天數必須是不小於 0 的整數' });
  }
  await db.prepare('UPDATE app_settings SET notify_email = ?, site_title = ?, new_badge_days = ? WHERE id = 1').run(
    notify_email ? notify_email.trim() : null,
    site_title ? site_title.trim() : null,
    badgeDays
  );
  const row = await db.prepare('SELECT notify_email, site_title, new_badge_days FROM app_settings WHERE id = 1').get();
  res.json(row);
});

// 公開：只回傳網站名稱與 New 標示天數，供前台頁面顯示，不含通知信箱等敏感設定
router.get('/site-info', async (req, res) => {
  const row = await db.prepare('SELECT site_title, new_badge_days FROM app_settings WHERE id = 1').get();
  res.json({
    site_title: row.site_title || '書法班報名系統',
    new_badge_days: row.new_badge_days ?? 7,
  });
});

module.exports = router;
