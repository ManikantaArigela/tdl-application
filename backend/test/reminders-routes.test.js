/**
 * HTTP contract for account-level voice reminder settings. The Asterisk and
 * push transports are stubbed by the console adapter, so this exercises the
 * consent gate, SIP validation, verification challenge, and opt-out.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-signing';
process.env.VOICE_PROVIDER = 'console';

const { createApp } = require('../app');
const memory = require('../test-utils/memory-repos');

const accounts = new Map();
let sequence = 0;

const users = {
  async create({ email, passwordHash }) {
    const user = {
      _id: `u_${++sequence}`,
      email,
      passwordHash,
      createdAt: new Date(),
      reminders: {},
      sipVerify: {},
    };
    accounts.set(user._id, user);
    return user;
  },
  async findByEmail(email, { withPassword = false } = {}) {
    const user = [...accounts.values()].find((entry) => entry.email === email);
    if (!user) return null;
    return withPassword ? user : { ...user };
  },
  async findById(id) {
    return accounts.get(id) ?? null;
  },
  async update(id, input) {
    const user = accounts.get(id);
    if (!user) return null;
    Object.assign(user, input);
    return { ...user };
  },
  async updateReminders(id, reminders) {
    const user = accounts.get(id);
    if (!user) return null;
    user.reminders = reminders;
    return { ...user };
  },
  async setSipVerify(id, sipVerify) {
    const user = accounts.get(id);
    if (!user) return null;
    user.sipVerify = sipVerify;
    return { ...user };
  },
  async clearSipVerify(id) {
    const user = accounts.get(id);
    if (!user) return null;
    user.sipVerify = { codeHash: null, expiresAt: null, attempts: 0, lastSentAt: null };
    return { ...user };
  },
  async markSipVerified(id) {
    const user = accounts.get(id);
    if (!user) return null;
    user.reminders = { ...(user.reminders || {}), sipVerifiedAt: Date.now() };
    user.sipVerify = { codeHash: null, expiresAt: null, attempts: 0, lastSentAt: null };
    return { ...user };
  },
  async disableReminders(id) {
    const user = accounts.get(id);
    if (!user) return null;
    user.reminders = { ...(user.reminders || {}), enabled: false };
    return { ...user };
  },
};

let server;
let baseUrl;
let token;

const request = (path, options = {}) =>
  fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

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

  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'voice@example.com', password: 'long-enough-password' }),
  });
  const body = await response.json();
  token = body.token;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('voice status and the push key are public', async () => {
  const status = await request('/api/voice/status');
  assert.equal(status.status, 200);
  assert.equal((await status.json()).provider, 'console');

  const key = await request('/api/push/key');
  assert.equal(key.status, 200);
  const body = await key.json();
  assert.equal(typeof body.publicKey, 'string');
  assert.ok(body.publicKey.length > 20);
});

test('reminder settings require consent before enabling calls', async () => {
  const response = await request('/api/reminders/settings', {
    method: 'PUT',
    body: JSON.stringify({
      enabled: true,
      sipUri: 'alice@sip.linphone.org',
      consent: false,
    }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Consent/i);
});

test('reminder settings validate the SIP address and enable push', async () => {
  const invalid = await request('/api/reminders/settings', {
    method: 'PUT',
    body: JSON.stringify({ sipUri: 'not-a-sip-address', consent: true }),
  });
  assert.equal(invalid.status, 200);
  assert.equal((await invalid.json()).settings.sipUri, '');

  const response = await request('/api/reminders/settings', {
    method: 'PUT',
    body: JSON.stringify({
      enabled: true,
      sipUri: 'Alice@SIP.Linphone.org',
      voiceLanguage: 'hi',
      timezone: 'Asia/Kolkata',
      quietStart: '22:00',
      quietEnd: '07:00',
      consent: true,
    }),
  });
  assert.equal(response.status, 200);
  const { settings } = await response.json();

  assert.equal(settings.enabled, true);
  assert.equal(settings.pushEnabled, true);
  assert.equal(settings.sipUri, 'alice@sip.linphone.org');
  assert.equal(settings.voiceLanguage, 'hi');
  assert.equal(settings.timezone, 'Asia/Kolkata');
  assert.equal(settings.sipVerified, false);
  assert.ok(settings.consentAt > 0);
});

test('a verification call confirms SIP ownership', async () => {
  const start = await request('/api/reminders/sip/verify/start', { method: 'POST' });
  assert.equal(start.status, 200);
  const { devCode } = await start.json();
  assert.match(devCode, /^\d{6}$/);

  const wrong = await request('/api/reminders/sip/verify/confirm', {
    method: 'POST',
    body: JSON.stringify({ code: '000000' }),
  });
  assert.equal(wrong.status, 400);

  const confirm = await request('/api/reminders/sip/verify/confirm', {
    method: 'POST',
    body: JSON.stringify({ code: devCode }),
  });
  assert.equal(confirm.status, 200);
  const { settings } = await confirm.json();
  assert.equal(settings.sipVerified, true);
  assert.ok(settings.sipVerifiedAt > 0);
});

test('a verified account can place a simulated test call', async () => {
  const response = await request('/api/reminders/test-call', { method: 'POST' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sent, true);
  assert.equal(body.provider, 'console');
  assert.equal(body.simulated, true);
});

test('changing the SIP address resets verification', async () => {
  const response = await request('/api/reminders/settings', {
    method: 'PUT',
    body: JSON.stringify({
      enabled: true,
      sipUri: 'bob@sip.linphone.org',
      consent: true,
    }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).settings.sipVerified, false);
});

test('withdrawing consent disables calls', async () => {
  const response = await request('/api/reminders/settings', {
    method: 'PUT',
    body: JSON.stringify({ consent: false }),
  });
  assert.equal(response.status, 200);
  const { settings } = await response.json();
  assert.equal(settings.enabled, false);
  assert.equal(settings.consentAt, null);
});
