require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { init } = require('./db/init');
const coursesRouter = require('./routes/courses');
const registrationsRouter = require('./routes/registrations');
const { courseQuestionsRouter, questionRouter } = require('./routes/questions');
const settingsRouter = require('./routes/settings');
const authRouter = require('./routes/auth');
const { requireAdminPage } = require('./middleware/adminAuth');

const app = express();
const PORT = process.env.PORT || 3000;

const cookieSecret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'calligraphy-registration-dev-secret';

app.use(express.json());
app.use(cookieParser(cookieSecret));

app.get('/admin.html', requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', authRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/courses/:courseId/questions', courseQuestionsRouter);
app.use('/api/questions', questionRouter);
app.use('/api/settings', settingsRouter);

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`書法班報名網站啟動：http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('資料庫初始化失敗：', err);
    process.exit(1);
  });
