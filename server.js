require('dotenv').config();

const express = require('express');
const path = require('path');
const coursesRouter = require('./routes/courses');
const registrationsRouter = require('./routes/registrations');
const { courseQuestionsRouter, questionRouter } = require('./routes/questions');
const settingsRouter = require('./routes/settings');
const requireAdminAuth = require('./middleware/adminAuth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/admin.html', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/courses', coursesRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/courses/:courseId/questions', courseQuestionsRouter);
app.use('/api/questions', questionRouter);
app.use('/api/settings', settingsRouter);

app.listen(PORT, () => {
  console.log(`書法班報名網站啟動：http://localhost:${PORT}`);
});
