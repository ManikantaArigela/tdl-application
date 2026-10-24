const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../app');
const memory = require('../test-utils/memory-repos');

// This file intentionally simulates an unreachable database: the health check
// has to report a degraded backend with a 503 rather than buffering or hanging.
let server;
let baseUrl;

before(async () => {
  const app = createApp({
    createRepos: () => memory.repos,
    authenticate: (req, res, next) => next(),
    checkDatabase: async () => {
      throw new Error('connection refused');
    },
  });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('health returns 503 when Supabase is unreachable', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.status, 'degraded');
  assert.equal(body.storage, 'supabase');
  assert.equal(body.error, 'Database unavailable');
});
