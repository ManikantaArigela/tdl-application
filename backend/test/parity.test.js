/**
 * Contract shape guard.
 *
 * The repository layer maps Mongo documents back to the exact key set and value
 * types the JSON store produced. These assertions fail loudly if a DTO change
 * ever leaks a Date, an ObjectId, or a new field into the API.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../app');
const repos = require('../repositories');
const mongo = require('../test-utils/mongo');

let server;
let baseUrl;

const NOTE_KEYS = ['id', 'title', 'content', 'tags', 'pinned', 'archived', 'createdAt', 'updatedAt'];
const TODO_KEYS = ['id', 'text', 'priority', 'completed', 'dueDate', 'completedAt', 'createdAt'];

before(
  async () => {
    await mongo.start();
    const app = createApp({ repos });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  },
  { timeout: 180_000 }
);

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongo.stop();
});

const post = (path, body) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => res.json());

test('note responses keep the exact legacy shape', async () => {
  const note = await post('/api/notes', { title: 'Shape', content: 'body', tags: ['a'] });

  assert.deepEqual(Object.keys(note).sort(), [...NOTE_KEYS].sort());
  assert.equal(typeof note.id, 'string');
  assert.equal(typeof note.title, 'string');
  assert.equal(typeof note.content, 'string');
  assert.ok(Array.isArray(note.tags));
  assert.equal(typeof note.pinned, 'boolean');
  assert.equal(typeof note.archived, 'boolean');
  assert.equal(typeof note.createdAt, 'number');
  assert.equal(typeof note.updatedAt, 'number');
  // No storage leakage.
  assert.equal(note._id, undefined);
  assert.equal(note.__v, undefined);
});

test('todo responses keep the exact legacy shape', async () => {
  const todo = await post('/api/todos', { text: 'Shape', priority: 'low' });

  assert.deepEqual(Object.keys(todo).sort(), [...TODO_KEYS].sort());
  assert.equal(typeof todo.id, 'string');
  assert.equal(typeof todo.text, 'string');
  assert.equal(todo.priority, 'low');
  assert.equal(typeof todo.completed, 'boolean');
  assert.equal(todo.dueDate, null);
  assert.equal(todo.completedAt, null);
  assert.equal(typeof todo.createdAt, 'number');
  assert.equal(todo._id, undefined);
  assert.equal(todo.order, undefined);
});

test('completion keeps completedAt as a number and dueDate as a string', async () => {
  const todo = await post('/api/todos', {
    text: 'Due soon',
    dueDate: '2026-11-01',
  });
  assert.equal(todo.dueDate, '2026-11-01');

  const updated = await fetch(`${baseUrl}/api/todos/${todo.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: true }),
  }).then((res) => res.json());

  assert.equal(updated.completed, true);
  assert.equal(typeof updated.completedAt, 'number');
  assert.deepEqual(Object.keys(updated).sort(), [...TODO_KEYS].sort());
});

test('invalid priorities fall back to medium and timestamps stay numeric', async () => {
  const todo = await post('/api/todos', { text: 'Weird priority', priority: 'urgent' });
  assert.equal(todo.priority, 'medium');
  assert.ok(Number.isFinite(todo.createdAt));
});
