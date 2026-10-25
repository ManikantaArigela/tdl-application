const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ISSUER = 'nova-notes';
const AUDIENCE = 'nova-notes-web';
const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A real bcrypt hash of a random value. Comparing against it when the account
// does not exist keeps login timing roughly constant (no user enumeration).
const DUMMY_HASH = '$2b$12$.I4SUC0IW1HhOd3N4YRwUe9vFqyhbFF03FAg0NYpGiSzYkn3HxhoS';

const authError = (message, status = 401) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

const emailLooksValid = (email) => {
  const normalized = normalizeEmail(email);
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized);
};

const passwordLooksValid = (password) =>
  typeof password === 'string' &&
  password.length >= MIN_PASSWORD_LENGTH &&
  password.length <= MAX_PASSWORD_LENGTH;

function isConfigured() {
  return Boolean(process.env.JWT_SECRET);
}

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw authError('Authentication is not configured on the server.', 503);
  return value;
}

const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || typeof hash !== 'string' || !hash) return false;
  return bcrypt.compare(password, hash);
}

/** Constant-work comparison used when no account matched the email. */
const verifyDummyPassword = (password) => bcrypt.compare(String(password ?? ''), DUMMY_HASH);

function signAccessToken(user) {
  const id = String(user._id ?? user.id ?? '');
  if (!id) throw new Error('signAccessToken requires a user');

  return jwt.sign(
    { sub: id, email: normalizeEmail(user.email) },
    secret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
      issuer: ISSUER,
      audience: AUDIENCE,
    }
  );
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
  } catch (error) {
    if (error?.name === 'TokenExpiredError') {
      throw authError('Your session has expired. Please sign in again.', 401);
    }
    throw authError('Could not verify your session. Please sign in again.', 401);
  }
}

function readBearerToken(req) {
  const header = req.headers?.authorization;
  if (typeof header !== 'string') return null;

  const [scheme, token] = header.trim().split(/\s+/);
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

/**
 * Verifies the JWT issued by /api/auth/login and attaches the account id to the
 * request. Stateless: every data repository then scopes queries by `req.userId`.
 */
async function requireAuth(req, res, next) {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Authentication is not configured on the server.' });
  }

  const token = readBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (error) {
    return res
      .status(error.status ?? 401)
      .json({ error: error.message || 'Please sign in again.' });
  }
}

module.exports = {
  ISSUER,
  AUDIENCE,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  normalizeEmail,
  emailLooksValid,
  passwordLooksValid,
  isConfigured,
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
  signAccessToken,
  verifyAccessToken,
  readBearerToken,
  requireAuth,
};
