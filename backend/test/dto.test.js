/**
 * Pure mapping guards for the MongoDB migration.
 *
 * MongoDB documents use `_id` and camelCase fields; imported Supabase rows use
 * snake_case. The API contract is camelCase with epoch milliseconds, so these
 * tests protect that boundary without needing a live database.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { toMs, toNoteDTO, toTodoDTO, toUserDTO } = require('../lib/dto');
const { mapError } = require('../lib/errors');

const ISO = '2026-10-24T12:00:00.000Z';
const MS = Date.parse(ISO);

test('toMs accepts ISO strings, Dates, numbers, and empty values', () => {
  assert.equal(toMs(ISO), MS);
  assert.equal(toMs(new Date(MS)), MS);
  assert.equal(toMs(MS), MS);
  assert.equal(toMs(null), null);
  assert.equal(toMs(undefined), null);
  assert.equal(toMs(''), null);
  assert.equal(toMs('not-a-date'), null);
});

test('note rows map from snake_case to the API shape', () => {
  const note = toNoteDTO({
    id: 'n_1',
    title: 'Title',
    content: 'Body',
    tags: ['a', 'b'],
    pinned: true,
    archived: false,
    created_at: ISO,
    updated_at: ISO,
  });

  assert.deepEqual(note, {
    id: 'n_1',
    title: 'Title',
    content: 'Body',
    tags: ['a', 'b'],
    pinned: true,
    archived: false,
    createdAt: MS,
    updatedAt: MS,
  });
  assert.equal(note.created_at, undefined);
  assert.equal(note.user_id, undefined);
});

test('MongoDB notes map _id to id and drop account internals', () => {
  const note = toNoteDTO({
    _id: 'n_2',
    userId: 'u_1',
    title: 'Mongo',
    content: 'Body',
    tags: ['x'],
    pinned: false,
    archived: true,
    createdAt: new Date(MS),
    updatedAt: new Date(MS),
  });

  assert.deepEqual(note, {
    id: 'n_2',
    title: 'Mongo',
    content: 'Body',
    tags: ['x'],
    pinned: false,
    archived: true,
    createdAt: MS,
    updatedAt: MS,
  });
  assert.equal(note._id, undefined);
  assert.equal(note.userId, undefined);
});

test('user documents expose only id, email, and createdAt', () => {
  assert.deepEqual(toUserDTO({ _id: 'u_1', email: 'a@example.com', passwordHash: 'secret' }), {
    id: 'u_1',
    email: 'a@example.com',
    createdAt: null,
  });
});

test('todo rows map from snake_case to the API shape', () => {
  const todo = toTodoDTO({
    id: 't_1',
    text: 'Task',
    priority: 'high',
    completed: true,
    due_date: '2026-10-24T12:00:00.000Z',
    due_time: '09:30',
    repeat: 'daily',
    completed_at: ISO,
    created_at: ISO,
  });

  assert.deepEqual(todo, {
    id: 't_1',
    text: 'Task',
    priority: 'high',
    completed: true,
    dueDate: '2026-10-24T12:00:00.000Z',
    dueTime: '09:30',
    repeat: 'daily',
    completedAt: MS,
    createdAt: MS,
  });
  assert.equal(todo.due_date, undefined);
  assert.equal(todo.completed_at, undefined);
});

test('todo rows tolerate null due fields', () => {
  const todo = toTodoDTO({
    id: 't_2',
    text: 'No due date',
    due_date: null,
    due_time: null,
    completed_at: null,
    created_at: ISO,
  });

  assert.equal(todo.dueDate, null);
  assert.equal(todo.dueTime, null);
  assert.equal(todo.completedAt, null);
  assert.equal(todo.priority, 'medium');
  assert.equal(todo.repeat, 'none');
});

test('database errors map to client-safe statuses', () => {
  assert.equal(mapError({ code: 11000, keyPattern: { email: 1 } }).status, 409);
  assert.equal(mapError({ name: 'ValidationError', errors: {} }).status, 400);
  assert.equal(mapError({ name: 'CastError', path: 'x' }).status, 400);
  assert.equal(mapError({ name: 'MongoNetworkError' }).status, 503);
  assert.equal(mapError({ name: 'MongoServerSelectionError' }).status, 503);
  assert.equal(mapError({ message: 'TypeError: fetch failed' }).status, 503);
  assert.equal(mapError(new SyntaxError('bad json')).status, 400);
  assert.equal(mapError(new Error('boom')).status, 500);
  assert.equal(mapError(null).status, 500);
});
