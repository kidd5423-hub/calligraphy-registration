const express = require('express');
const db = require('../db/init');
const { sendRegistrationNotification } = require('../utils/mailer');

const router = express.Router();

const getAnswersForRegistration = db.prepare(`
  SELECT ra.question_id, ra.answer_value, cq.question_text, cq.type
  FROM registration_answers ra
  JOIN course_questions cq ON cq.id = ra.question_id
  WHERE ra.registration_id = ?
  ORDER BY cq.sort_order ASC, cq.id ASC
`);

function attachAnswers(registration) {
  const answers = getAnswersForRegistration.all(registration.id).map(a => ({
    question_id: a.question_id,
    question_text: a.question_text,
    value: a.type === 'multiple' ? JSON.parse(a.answer_value) : a.answer_value,
  }));
  return { ...registration, answers };
}

function isEmptyAnswer(val) {
  return val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
}

function validateAnswers(questions, answers) {
  const answerMap = new Map((answers || []).map(a => [a.question_id, a.value]));
  for (const q of questions) {
    const val = answerMap.get(q.id);
    const empty = isEmptyAnswer(val);

    if (q.required && empty) {
      return `「${q.question_text}」為必填`;
    }
    if (empty) continue;

    if (q.type === 'single') {
      const options = JSON.parse(q.options);
      if (typeof val !== 'string' || !options.includes(val)) {
        return `「${q.question_text}」的答案不在選項內`;
      }
    } else if (q.type === 'multiple') {
      const options = JSON.parse(q.options);
      if (!Array.isArray(val) || val.some(v => !options.includes(v))) {
        return `「${q.question_text}」的答案不在選項內`;
      }
    } else if (q.type === 'number') {
      if (val === '' || isNaN(Number(val))) {
        return `「${q.question_text}」必須是數字`;
      }
    }
  }
  return null;
}

// 新增報名
router.post('/', async (req, res) => {
  const { course_id, name, phone, email, note, answers } = req.body;

  if (!course_id) return res.status(400).json({ error: '缺少課程資訊' });
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: '姓名為必填' });
  }

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(course_id);
  if (!course) return res.status(404).json({ error: '找不到課程' });

  const today = new Date().toISOString().slice(0, 10);
  if (today < course.reg_start) return res.status(400).json({ error: '此課程報名尚未開始' });
  if (today > course.reg_end) return res.status(400).json({ error: '此課程報名已截止' });

  if (course.capacity !== null) {
    const currentCount = db.prepare('SELECT COUNT(*) AS c FROM registrations WHERE course_id = ?').get(course_id).c;
    if (currentCount >= course.capacity) return res.status(400).json({ error: '名額已滿' });
  }

  const questions = db.prepare('SELECT * FROM course_questions WHERE course_id = ?').all(course_id);
  const answerError = validateAnswers(questions, answers);
  if (answerError) return res.status(400).json({ error: answerError });

  const result = db.prepare(`
    INSERT INTO registrations (course_id, name, phone, email, note)
    VALUES (?, ?, ?, ?, ?)
  `).run(course_id, name.trim(), phone || null, email || null, note || null);

  const insertAnswer = db.prepare(`
    INSERT INTO registration_answers (registration_id, question_id, answer_value)
    VALUES (?, ?, ?)
  `);
  const answerMap = new Map((answers || []).map(a => [a.question_id, a.value]));
  for (const q of questions) {
    const val = answerMap.get(q.id);
    if (isEmptyAnswer(val)) continue;
    insertAnswer.run(result.lastInsertRowid, q.id, Array.isArray(val) ? JSON.stringify(val) : String(val));
  }

  const registration = db.prepare('SELECT * FROM registrations WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(registration);

  const { answers: savedAnswers } = attachAnswers(registration);
  sendRegistrationNotification({ course, registration, answers: savedAnswers });
});

// 依課程查詢報名列表（不帶 course_id 則回傳全部），每筆附上自訂題目答案
router.get('/', (req, res) => {
  const { course_id } = req.query;
  const rows = course_id
    ? db.prepare('SELECT * FROM registrations WHERE course_id = ? ORDER BY id DESC').all(course_id)
    : db.prepare('SELECT * FROM registrations ORDER BY id DESC').all();
  res.json(rows.map(attachAnswers));
});

module.exports = router;
