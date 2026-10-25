const { test } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../db');

test('maskUri never logs the password', () => {
  const masked = db.maskUri('mongodb://user:secret@host:27017/nova_notes?ssl=true');
  assert.equal(masked, 'mongodb://user:***@host:27017/nova_notes?ssl=true');
  assert.equal(masked.includes('secret'), false);
});

test('maskUri leaves credential-free URIs untouched', () => {
  const uri = 'mongodb://127.0.0.1:27017/nova_notes';
  assert.equal(db.maskUri(uri), uri);
});

test('ping fails fast when MongoDB is not connected', async () => {
  assert.equal(db.isConnected(), false);
  await assert.rejects(() => db.ping(), /not connected/i);
});
