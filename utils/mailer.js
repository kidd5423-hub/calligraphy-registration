const { db } = require('../db/init');

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_FROM = 'onboarding@resend.dev';

async function sendRegistrationNotification({ course, registration, answers }) {
  const settings = await db.prepare('SELECT notify_email FROM app_settings WHERE id = 1').get();
  if (!settings || !settings.notify_email) {
    console.log('[mailer] 未設定通知信箱，略過寄信');
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[mailer] 未設定 RESEND_API_KEY 環境變數，略過寄信');
    return;
  }

  const answerLines = (answers && answers.length > 0)
    ? answers.map(a => `${a.question_text}：${Array.isArray(a.value) ? a.value.join('、') : a.value}`).join('\n')
    : '（無自訂題目）';

  const text = [
    `課程：${course.name}`,
    `姓名：${registration.name}`,
    `聯絡人：${registration.contact_name || '-'}`,
    `電話：${registration.phone || '-'}`,
    `Email：${registration.email || '-'}`,
    `備註：${registration.note || '-'}`,
    `報名時間：${registration.created_at}`,
    '',
    '自訂題目答案：',
    answerLines,
  ].join('\n');

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [settings.notify_email],
        subject: `【書法班報名通知】${course.name} - ${registration.name}`,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }

    console.log(`[mailer] 已寄送報名通知信到 ${settings.notify_email}`);
  } catch (err) {
    console.error(`[mailer] 寄信失敗（收件者：${settings.notify_email}）：`, err.message);
  }
}

module.exports = { sendRegistrationNotification };
