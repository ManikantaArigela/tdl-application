/**
 * Authentication tests: token/password primitives plus the /api/auth routes.
 * Everything runs in-process with an in-memory account store.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-signing';

const { createApp } = require('../app');
const authLib = require('../lib/auth');
const memory = require('../test-utils/memory-repos');

const accounts = new Map();
let sequence = 0;

const users = {
  async create({ email, passwordHash }) {
    if ([...accounts.values()].some((user) => user.email === email)) {
      const error = new Error('duplicate key');
      error.code = 11000;
      error.keyPattern = { email: 1 };
      throw error;
    }
    const user = {
      _id: `u_${++sequence}`,
      email,
      passwordHash,
      createdAt: new Date(),
    };
    accounts.set(user._id, user);
    return user;
  },
  async findByEmail(email, { withPassword = false } = {}) {
    const user = [...accounts.values()].find((entry) => entry.email === email);
    if (!user) return null;
    if (withPassword) return user;
    return { _id: user._id, email: user.email, createdAt: user.createdAt };
  },
  async findById(id) {
    return accounts.get(id) ?? null;
  },
};

let server;
let baseUrl;

before(async () => {
  const app = createApp({
    createRepos: () => memory.repos,
    checkDatabase: async () => true,
    users,
  });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

const post = (path, body, token) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

test('password hashing is salted and verifiable', async () => {
  const first = await authLib.hashPassword('correct horse battery');
  const second = await authLib.hashPassword('correct horse battery');

  assert.notEqual(first, second);
  assert.equal(await authLib.verifyPassword('correct horse battery', first), true);
  assert.equal(await authLib.verifyPassword('wrong password', first), false);
  assert.equal(await authLib.verifyPassword('anything', 'not-a-hash'), false);
});

test('access tokens round-trip and reject tampering', () => {
  const token = authLib.signAccessToken({ _id: 'u_1', email: 'a@example.com' });
  const payload = authLib.verifyAccessToken(token);

  assert.equal(payload.sub, 'u_1');
  assert.equal(payload.email, 'a@example.com');
  assert.throws(() => authLib.verifyAccessToken(`${token}x`), /session|verify/i);
});

test('expired access tokens are reported as 401', () => {
  const previous = process.env.JWT_EXPIRES_IN;
  process.env.JWT_EXPIRES_IN = '-1s';
  try {
    const token = authLib.signAccessToken({ _id: 'u_1', email: 'a@example.com' });
    assert.throws(
      () => authLib.verifyAccessToken(token),
      (error) => error.status === 401 && /expired/i.test(error.message)
    );
  } finally {
    if (previous === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = previous;
  }
});

test('signup creates an account and returns a token without the hash', async () => {
  const response = await post('/api/auth/signup', {
    email: '  Student@Example.com ',
    password: 'long-enough-password',
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(typeof body.token, 'string');
  assert.equal(body.user.email, 'student@example.com');
  assert.equal(body.user.passwordHash, undefined);
  assert.equal(body.user._id, undefined);
  assert.equal(authLib.verifyAccessToken(body.token).sub, body.user.id);
});

test('signup rejects invalid email, short passwords, and duplicates', async () => {
  const invalidEmail = await post('/api/auth/signup', {
    email: 'not-an-email',
    password: 'long-enough-password',
  });
  assert.equal(invalidEmail.status, 400);

  const shortPassword = await post('/api/auth/signup', {
    email: 'short@example.com',
    password: 'short',
  });
  assert.equal(shortPassword.status, 400);
  assert.match((await shortPassword.json()).error, /at least 8/);

  const duplicate = await post('/api/auth/signup', {
    email: 'student@example.com',
    password: 'long-enough-password',
  });
  assert.equal(duplicate.status, 409);
});

test('login succeeds with the right password and is generic otherwise', async () => {
  const login = await post('/api/auth/login', {
    email: 'student@example.com',
    password: 'long-enough-password',
  });
  const body = await login.json();
  assert.equal(login.status, 200);
  assert.equal(typeof body.token, 'string');

  const wrong = await post('/api/auth/login', {
    email: 'student@example.com',
    password: 'not-the-password',
  });
  assert.equal(wrong.status, 401);
  assert.equal((await wrong.json()).error, 'Incorrect email or password.');

  const unknown = await post('/api/auth/login', {
    email: 'nobody@example.com',
    password: 'not-the-password',
  });
  assert.equal(unknown.status, 401);
  assert.equal((await unknown.json()).error, 'Incorrect email or password.');
});

test('/api/auth/me requires a valid token and returns the account', async () => {
  const login = await post('/api/auth/login', {
    email: 'student@example.com',
    password: 'long-enough-password',
  });
  const { token } = await login.json();

  const unauthorized = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(unauthorized.status, 401);

  const me = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await me.json();
  assert.equal(me.status, 200);
  assert.equal(body.user.email, 'student@example.com');
});

test('protected data routes accept the issued token', async () => {
  const login = await post('/api/auth/login', {
    email: 'student@example.com',
    password: 'long-enough-password',
  });
  const { token } = await login.json();

  const response = await fetch(`${baseUrl}/api/notes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(await response.json()));
});
