const express = require('express');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  signed: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
};

router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(400).json({ error: '伺服器尚未設定管理者密碼' });
  }
  if (password !== adminPassword) {
    return res.status(401).json({ error: '密碼錯誤' });
  }

  res.cookie('admin_session', 'ok', COOKIE_OPTIONS);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_session');
  res.json({ ok: true });
});

module.exports = router;
