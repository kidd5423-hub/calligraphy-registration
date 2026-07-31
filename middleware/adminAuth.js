function hasValidSession(req) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return true;
  return !!(req.signedCookies && req.signedCookies.admin_session === 'ok');
}

// 用在 API 路由：沒登入回傳 401 JSON
function requireAdminAuth(req, res, next) {
  if (hasValidSession(req)) return next();
  res.status(401).json({ error: '需要管理者登入才能存取' });
}

// 用在 /admin.html 這個頁面本身：沒登入導去登入頁
function requireAdminPage(req, res, next) {
  if (hasValidSession(req)) return next();
  res.redirect('/login.html');
}

module.exports = { requireAdminAuth, requireAdminPage };
