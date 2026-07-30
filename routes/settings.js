const express = require('express');
const db = require('../db/init');

const router = express.Router();

router.get('/', (req, res) => {
  const row = db.prepare('SELECT notify_email FROM app_settings WHERE id = 1').get();
  res.json(row);
});

router.put('/', (req, res) => {
  const { notify_email } = req.body;
  if (notify_email && typeof notify_email !== 'string') {
    return res.status(400).json({ error: 'notify_email 必須是字串' });
  }
  db.prepare('UPDATE app_settings SET notify_email = ? WHERE id = 1').run(notify_email ? notify_email.trim() : null);
  const row = db.prepare('SELECT notify_email FROM app_settings WHERE id = 1').get();
  res.json(row);
});

module.exports = router;
