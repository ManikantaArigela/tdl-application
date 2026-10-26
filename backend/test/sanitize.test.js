/**
 * Guards for the shared input normalization helpers. These run without a
 * database so regressions in clamping/defaulting surface early.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeTodo,
  sanitizeProfile,
  AVATAR_PATTERN,
} = require('../lib/sanitize');

test('sanitizeTodo normalizes duration to whole minutes with a 600 cap', () => {
  assert.equal(sanitizeTodo({ text: 'Task', duration: 45 }).duration, 45);
  assert.equal(sanitizeTodo({ text: 'Task', duration: '30' }).duration, 30);
  assert.equal(sanitizeTodo({ text: 'Task', duration: 30.6 }).duration, 31);
  assert.equal(sanitizeTodo({ text: 'Task', duration: 9999 }).duration, 600);
  assert.equal(sanitizeTodo({ text: 'Task', duration: null }).duration, null);
  assert.equal(sanitizeTodo({ text: 'Task', duration: '' }).duration, null);
  // Missing duration keeps the previous value / defaults to null.
  assert.equal(sanitizeTodo({ text: 'Task' }, { duration: 60 }).duration, 60);
  assert.equal(sanitizeTodo({ text: 'Task' }).duration, null);
  assert.equal(sanitizeTodo({ text: 'Task', duration: 'junk' }).duration, null);
});

test('sanitizeProfile keeps known fields and drops unknown avatars', () => {
  const base = { name: 'Old', bio: 'Old bio', avatar: 'sunrise' };

  assert.deepEqual(sanitizeProfile({ name: '  Ada  ', bio: 'b'.repeat(400) }, base), {
    name: 'Ada',
    bio: 'b'.repeat(280),
    avatar: 'sunrise',
  });

  assert.deepEqual(sanitizeProfile({ avatar: 'ocean-wave' }, base).avatar, 'ocean-wave');
  assert.deepEqual(sanitizeProfile({ avatar: 'Not Valid!' }, base).avatar, '');
  assert.deepEqual(sanitizeProfile({ avatar: 42 }, base).avatar, '');
  // Untouched fields keep their previous values.
  assert.deepEqual(sanitizeProfile({ name: 'New' }, base), {
    name: 'New',
    bio: 'Old bio',
    avatar: 'sunrise',
  });
  assert.deepEqual(sanitizeProfile(), { name: '', bio: '', avatar: '' });
});

test('AVATAR_PATTERN matches the predefined avatar ids', () => {
  assert.equal(AVATAR_PATTERN.test('sunrise'), true);
  assert.equal(AVATAR_PATTERN.test('ocean-wave-2'), true);
  assert.equal(AVATAR_PATTERN.test(''), false);
  assert.equal(AVATAR_PATTERN.test('Big Cat'), false);
});
