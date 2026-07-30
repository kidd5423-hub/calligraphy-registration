const nodemailer = require('nodemailer');
const db = require('../db/init');

function buildTransporter() {
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendRegistrationNotification({ course, registration, answers }) {
  const settings = db.prepare('SELECT notify_email FROM app_settings WHERE id = 1').get();
  if (!settings || !settings.notify_email) {
    console.log('[mailer] 未設定通知信箱，略過寄信');
    return;
  }

  const transporter = buildTransporter();
  if (!transporter) {
    console.log('[mailer] 未設定 SMTP_USER/SMTP_PASS 環境變數，略過寄信');
    return;
  }

  const answerLines = (answers && answers.length > 0)
    ? answers.map(a => `${a.question_text}：${Array.isArray(a.value) ? a.value.join('、') : a.value}`).join('\n')
    : '（無自訂題目）';

  const text = [
    `課程：${course.name}`,
    `姓名：${registration.name}`,
    `電話：${registration.phone || '-'}`,
    `Email：${registration.email || '-'}`,
    `備註：${registration.note || '-'}`,
    `報名時間：${registration.created_at}`,
    '',
    '自訂題目答案：',
    answerLines,
  ].join('\n');

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: settings.notify_email,
      subject: `【書法班報名通知】${course.name} - ${registration.name}`,
      text,
    });
    console.log(`[mailer] 已寄送報名通知信到 ${settings.notify_email}`);
  } catch (err) {
    console.error('[mailer] 寄信失敗：', err.message);
  }
}

module.exports = { sendRegistrationNotification };
