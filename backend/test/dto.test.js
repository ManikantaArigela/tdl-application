/**
 * Pure mapping guards for the Supabase migration.
 *
 * PostgREST returns snake_case columns and ISO timestamps. The API contract is
 * camelCase with epoch milliseconds. These tests protect that boundary without
 * needing a live database.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { toMs, toNoteDTO, toTodoDTO } = require('../lib/dto');
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
  assert.equal(mapError({ code: '23505' }).status, 409);
  assert.equal(mapError({ code: '23514' }).status, 400);
  assert.equal(mapError({ code: '42501' }).status, 403);
  assert.equal(mapError({ code: '42P01' }).status, 503);
  assert.equal(mapError({ code: 'PGRST301' }).status, 401);
  assert.equal(mapError({ message: 'TypeError: fetch failed' }).status, 503);
  assert.equal(mapError(new SyntaxError('bad json')).status, 400);
  assert.equal(mapError(new Error('boom')).status, 500);
  assert.equal(mapError(null).status, 500);
});
