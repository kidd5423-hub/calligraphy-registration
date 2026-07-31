function requireAdminAuth(req, res, next) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return next();

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    const pass = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : '';
    if (pass === password) return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Admin"');
  res.status(401).send('需要管理者密碼才能存取');
}

module.exports = requireAdminAuth;
