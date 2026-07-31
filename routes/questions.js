const express = require('express');
const { db } = require('../db/init');
const { requireAdminAuth } = require('../middleware/adminAuth');

const VALID_TYPES = ['text', 'number', 'single', 'multiple'];

function parseQuestion(row) {
  return {
    ...row,
    options: row.options ? JSON.parse(row.options) : null,
    required: !!row.required,
  };
}

function validatePayload(body) {
  const { question_text, type, options, required } = body;
  if (!question_text || typeof question_text !== 'string' || !question_text.trim()) {
    return '題目文字為必填';
  }
  if (!VALID_TYPES.includes(type)) {
    return '題型必須是 text、number、single 或 multiple';
  }
  if ((type === 'single' || type === 'multiple')) {
    if (!Array.isArray(options) || options.length === 0 || options.some(o => typeof o !== 'string' || !o.trim())) {
      return '單選/多選題必須提供至少一個選項';
    }
  }
  if (required !== undefined && typeof required !== 'boolean') {
    return 'required 必須是布林值';
  }
  return null;
}

// 依課程列出題目（GET /api/courses/:courseId/questions）
const courseQuestionsRouter = express.Router({ mergeParams: true });

courseQuestionsRouter.get('/', async (req, res) => {
  const course = await db.prepare('SELECT id FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) return res.status(404).json({ error: '找不到課程' });

  const rows = await db.prepare('SELECT * FROM course_questions WHERE course_id = ? ORDER BY sort_order ASC, id ASC').all(req.params.courseId);
  res.json(rows.map(parseQuestion));
});

courseQuestionsRouter.post('/', requireAdminAuth, async (req, res) => {
  const course = await db.prepare('SELECT id FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) return res.status(404).json({ error: '找不到課程' });

  const error = validatePayload(req.body);
  if (error) return res.status(400).json({ error });

  const { question_text, type, options, required, sort_order } = req.body;
  const countRow = await db.prepare('SELECT COUNT(*) AS c FROM course_questions WHERE course_id = ?').get(req.params.courseId);
  const finalSortOrder = sort_order ?? countRow.c;

  const result = await db.prepare(`
    INSERT INTO course_questions (course_id, question_text, type, options, required, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    req.params.courseId,
    question_text.trim(),
    type,
    (type === 'single' || type === 'multiple') ? JSON.stringify(options) : null,
    required ? 1 : 0,
    finalSortOrder
  );

  const question = await db.prepare('SELECT * FROM course_questions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseQuestion(question));
});

// 編輯/刪除單一題目（PUT|DELETE /api/questions/:id）
const questionRouter = express.Router();

questionRouter.put('/:id', requireAdminAuth, async (req, res) => {
  const existing = await db.prepare('SELECT * FROM course_questions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '找不到題目' });

  const error = validatePayload(req.body);
  if (error) return res.status(400).json({ error });

  const { question_text, type, options, required, sort_order } = req.body;
  await db.prepare(`
    UPDATE course_questions
    SET question_text = ?, type = ?, options = ?, required = ?, sort_order = ?
    WHERE id = ?
  `).run(
    question_text.trim(),
    type,
    (type === 'single' || type === 'multiple') ? JSON.stringify(options) : null,
    required ? 1 : 0,
    sort_order ?? existing.sort_order,
    req.params.id
  );

  const question = await db.prepare('SELECT * FROM course_questions WHERE id = ?').get(req.params.id);
  res.json(parseQuestion(question));
});

questionRouter.delete('/:id', requireAdminAuth, async (req, res) => {
  const existing = await db.prepare('SELECT * FROM course_questions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '找不到題目' });

  await db.prepare('DELETE FROM registration_answers WHERE question_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM course_questions WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = { courseQuestionsRouter, questionRouter };
