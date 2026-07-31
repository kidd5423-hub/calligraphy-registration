const express = require('express');
const db = require('../db/init');
const requireAdminAuth = require('../middleware/adminAuth');

const router = express.Router();

function validateCoursePayload(body) {
  const { name, reg_start, reg_end } = body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return '課程名稱為必填';
  }
  if (!reg_start || !reg_end) {
    return '報名開始與結束日期為必填';
  }
  if (reg_start > reg_end) {
    return '報名開始日期不可晚於結束日期';
  }
  return null;
}

const getRegisteredCount = db.prepare('SELECT COUNT(*) AS c FROM registrations WHERE course_id = ?');

function attachRegisteredCount(course) {
  return { ...course, registered_count: getRegisteredCount.get(course.id).c };
}

// 取得課程列表
router.get('/', (req, res) => {
  const courses = db.prepare('SELECT * FROM courses ORDER BY reg_start DESC, id DESC').all();
  res.json(courses.map(attachRegisteredCount));
});

// 取得單一課程
router.get('/:id', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: '找不到課程' });
  res.json(attachRegisteredCount(course));
});

// 新增課程
router.post('/', requireAdminAuth, (req, res) => {
  const error = validateCoursePayload(req.body);
  if (error) return res.status(400).json({ error });

  const { name, description, schedule_text, capacity, reg_start, reg_end } = req.body;
  const result = db.prepare(`
    INSERT INTO courses (name, description, schedule_text, capacity, reg_start, reg_end)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name.trim(), description || null, schedule_text || null, capacity || null, reg_start, reg_end);

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(course);
});

// 編輯課程
router.put('/:id', requireAdminAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '找不到課程' });

  const error = validateCoursePayload(req.body);
  if (error) return res.status(400).json({ error });

  const { name, description, schedule_text, capacity, reg_start, reg_end } = req.body;
  db.prepare(`
    UPDATE courses
    SET name = ?, description = ?, schedule_text = ?, capacity = ?, reg_start = ?, reg_end = ?
    WHERE id = ?
  `).run(name.trim(), description || null, schedule_text || null, capacity || null, reg_start, reg_end, req.params.id);

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  res.json(course);
});

// 複製課程（含自訂題目）
router.post('/:id/duplicate', requireAdminAuth, (req, res) => {
  const original = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!original) return res.status(404).json({ error: '找不到課程' });

  const result = db.prepare(`
    INSERT INTO courses (name, description, schedule_text, capacity, reg_start, reg_end)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `${original.name}（複製）`,
    original.description,
    original.schedule_text,
    original.capacity,
    original.reg_start,
    original.reg_end
  );
  const newCourseId = result.lastInsertRowid;

  const questions = db.prepare('SELECT * FROM course_questions WHERE course_id = ?').all(req.params.id);
  const insertQuestion = db.prepare(`
    INSERT INTO course_questions (course_id, question_text, type, options, required, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const q of questions) {
    insertQuestion.run(newCourseId, q.question_text, q.type, q.options, q.required, q.sort_order);
  }

  const newCourse = db.prepare('SELECT * FROM courses WHERE id = ?').get(newCourseId);
  res.status(201).json(newCourse);
});

// 刪除課程
router.delete('/:id', requireAdminAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '找不到課程' });

  const registrationIds = db.prepare('SELECT id FROM registrations WHERE course_id = ?').all(req.params.id).map(r => r.id);
  const deleteAnswersForRegistration = db.prepare('DELETE FROM registration_answers WHERE registration_id = ?');
  for (const regId of registrationIds) deleteAnswersForRegistration.run(regId);

  db.prepare('DELETE FROM registrations WHERE course_id = ?').run(req.params.id);
  db.prepare('DELETE FROM course_questions WHERE course_id = ?').run(req.params.id);
  db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
