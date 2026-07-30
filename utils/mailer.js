const nodemailer = require('nodemailer');
const dns = require('dns').promises;
const db = require('../db/init');

const SMTP_HOSTNAME = 'smtp.gmail.com';

// 部分雲端主機（例如 Render）對外的 IPv6 連線不通，但 Node/nodemailer 解析
// smtp.gmail.com 時可能拿到 IPv6 位址，導致連線失敗（ENETUNREACH）。
// 這裡自己先解析出 IPv4 位址再連線，並用 tls.servername 保留原本主機名稱
// 做 SNI／憑證驗證，避免直接用 IP 連線導致憑證檢查失敗。
async function buildTransporter() {
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return null;

  let host = SMTP_HOSTNAME;
  try {
    const addresses = await dns.resolve4(SMTP_HOSTNAME);
    if (addresses && addresses[0]) host = addresses[0];
  } catch (err) {
    console.log('[mailer] IPv4 解析失敗，改用主機名稱直接連線：', err.message);
  }

  return nodemailer.createTransport({
    host,
    port: 587,
    secure: false,
    requireTLS: true,
    connectionTimeout: 15000,
    tls: { servername: SMTP_HOSTNAME },
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendRegistrationNotification({ course, registration, answers }) {
  const settings = db.prepare('SELECT notify_email FROM app_settings WHERE id = 1').get();
  if (!settings || !settings.notify_email) {
    console.log('[mailer] 未設定通知信箱，略過寄信');
    return;
  }

  const transporter = await buildTransporter();
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
    console.error(`[mailer] 寄信失敗（收件者：${settings.notify_email}）：`, err.code || '', err.message);
  }
}

module.exports = { sendRegistrationNotification };
