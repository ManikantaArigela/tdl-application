const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { createApp } = require('../server');

let server;
let baseUrl;
let dataDir;

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-api-test-'));
  const app = createApp({ dataDir });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (dataDir) await fs.rm(dataDir, { recursive: true, force: true });
});

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

const json = (payload) => ({ body: JSON.stringify(payload) });

test('health reports the JSON storage backend', async () => {
  const { response, body } = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.storage, 'json');
});

test('notes support create, read, update, and delete', async () => {
  const created = await request('/api/notes', {
    method: 'POST',
    ...json({ title: 'First note', content: 'Hello', tags: ['work', 'work', '  ideas '] }),
  });
  assert.equal(created.response.status, 201);
  assert.match(created.body.id, /^n_/);
  assert.deepEqual(created.body.tags, ['work', 'ideas']);
  assert.equal(created.body.archived, false);

  const list = await request('/api/notes');
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].title, 'First note');

  const updated = await request(`/api/notes/${created.body.id}`, {
    method: 'PUT',
    ...json({ pinned: true }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.pinned, true);
  assert.equal(updated.body.title, 'First note');
  assert.ok(updated.body.updatedAt >= created.body.updatedAt);

  const removed = await request(`/api/notes/${created.body.id}`, { method: 'DELETE' });
  assert.equal(removed.response.status, 200);

  const missing = await request(`/api/notes/${created.body.id}`, { method: 'DELETE' });
  assert.equal(missing.response.status, 404);
  assert.equal(missing.body.error, 'Note not found');
});

test('todos require text and track completion timestamps', async () => {
  const invalid = await request('/api/todos', { method: 'POST', ...json({ text: '   ' }) });
  assert.equal(invalid.response.status, 400);

  const created = await request('/api/todos', {
    method: 'POST',
    ...json({ text: 'Write tests', priority: 'high' }),
  });
  assert.equal(created.response.status, 201);
  assert.match(created.body.id, /^t_/);
  assert.equal(created.body.completed, false);
  assert.equal(created.body.completedAt, null);

  const completed = await request(`/api/todos/${created.body.id}`, {
    method: 'PUT',
    ...json({ completed: true, completedAt: 1_700_000_000_000 }),
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completed.body.completed, true);
  assert.equal(completed.body.completedAt, 1_700_000_000_000);

  const reopened = await request(`/api/todos/${created.body.id}`, {
    method: 'PUT',
    ...json({ completed: false }),
  });
  assert.equal(reopened.body.completed, false);
  assert.equal(reopened.body.completedAt, null);
});

test('reorder persists order and never drops unsent todos', async () => {
  // Start from an empty list so ordering assertions are deterministic.
  const current = await request('/api/todos');
  await Promise.all(
    current.body.map((todo) => request(`/api/todos/${todo.id}`, { method: 'DELETE' }))
  );

  const first = await request('/api/todos', { method: 'POST', ...json({ text: 'First' }) });
  const second = await request('/api/todos', { method: 'POST', ...json({ text: 'Second' }) });

  const reordered = await request('/api/todos/reorder', {
    method: 'PUT',
    ...json({ todos: [{ id: first.body.id }, { id: second.body.id }] }),
  });
  assert.equal(reordered.response.status, 200);
  assert.deepEqual(
    reordered.body.map((todo) => todo.text),
    ['First', 'Second']
  );

  // A filtered client list must not delete the omitted todo.
  const partial = await request('/api/todos/reorder', {
    method: 'PUT',
    ...json({ todos: [{ id: second.body.id }] }),
  });
  assert.equal(partial.response.status, 200);
  assert.equal(partial.body.length, 2);
  assert.equal(partial.body[0].id, second.body.id);
  assert.equal(partial.body[1].id, first.body.id);

  const bogus = await request('/api/todos/reorder', {
    method: 'PUT',
    ...json({ todos: 'nope' }),
  });
  assert.equal(bogus.response.status, 400);
});

test('unknown API routes and unknown ids return JSON 404s', async () => {
  const route = await request('/api/does-not-exist');
  assert.equal(route.response.status, 404);

  const todo = await request('/api/todos/missing', {
    method: 'PUT',
    ...json({ completed: true }),
  });
  assert.equal(todo.response.status, 404);
  assert.equal(todo.body.error, 'Todo not found');
});

test('malformed JSON returns a 400 instead of crashing', async () => {
  const response = await fetch(`${baseUrl}/api/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, 'Request body is not valid JSON');
});
