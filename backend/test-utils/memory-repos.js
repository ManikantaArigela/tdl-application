/**
 * In-memory implementation of the repository contract for route tests.
 *
 * Rows are stored in the same snake_case shape Supabase returns and mapped
 * through lib/dto, so the tests still guard the API boundary without requiring
 * a live Supabase project.
 */
const crypto = require('crypto');

const { sanitizeNote, sanitizeTodo } = require('../lib/sanitize');
const { toNoteDTO, toTodoDTO } = require('../lib/dto');

const state = { notes: [], todos: [] };
let tick = 0;

const stamp = () => new Date(1_700_000_000_000 + tick++ * 1_000).toISOString();
const iso = (ms) => (typeof ms === 'number' ? new Date(ms).toISOString() : null);

function reset() {
  state.notes.length = 0;
  state.todos.length = 0;
  tick = 0;
}

const notes = {
  list: async () =>
    [...state.notes]
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
      .map(toNoteDTO),

  create: async (input = {}) => {
    const note = sanitizeNote(input);
    const now = stamp();
    const row = {
      id: `n_${crypto.randomUUID()}`,
      title: note.title,
      content: note.content,
      tags: note.tags,
      pinned: note.pinned,
      archived: note.archived,
      created_at: now,
      updated_at: now,
    };
    state.notes.push(row);
    return toNoteDTO(row);
  },

  update: async (id, input = {}) => {
    const row = state.notes.find((note) => note.id === id);
    if (!row) return null;

    const next = sanitizeNote(input, toNoteDTO(row));
    Object.assign(row, {
      title: next.title,
      content: next.content,
      tags: next.tags,
      pinned: next.pinned,
      archived: next.archived,
      updated_at: stamp(),
    });
    return toNoteDTO(row);
  },

  remove: async (id) => {
    const index = state.notes.findIndex((note) => note.id === id);
    if (index < 0) return false;
    state.notes.splice(index, 1);
    return true;
  },
};

const todos = {
  list: async () =>
    [...state.todos]
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          a.created_at.localeCompare(b.created_at) ||
          a.id.localeCompare(b.id)
      )
      .map(toTodoDTO),

  create: async (input = {}) => {
    const todo = sanitizeTodo(input);
    if (!todo.text) return { ok: false, reason: 'invalid' };

    const lowest = state.todos.reduce(
      (min, row) => (row.sort_order < min ? row.sort_order : min),
      0
    );
    const row = {
      id: `t_${crypto.randomUUID()}`,
      text: todo.text,
      priority: todo.priority,
      completed: todo.completed,
      due_date: todo.dueDate,
      due_time: todo.dueTime,
      repeat: todo.repeat,
      completed_at: iso(todo.completedAt),
      created_at: stamp(),
      sort_order: state.todos.length === 0 ? 0 : lowest - 1,
    };
    state.todos.push(row);
    return { ok: true, todo: toTodoDTO(row) };
  },

  update: async (id, input = {}) => {
    const row = state.todos.find((todo) => todo.id === id);
    if (!row) return { ok: false, reason: 'not_found' };

    const next = sanitizeTodo(input, toTodoDTO(row));
    if (!next.text) return { ok: false, reason: 'invalid' };

    Object.assign(row, {
      text: next.text,
      priority: next.priority,
      completed: next.completed,
      due_date: next.dueDate,
      due_time: next.dueTime,
      repeat: next.repeat,
      completed_at: iso(next.completedAt),
    });
    return { ok: true, todo: toTodoDTO(row) };
  },

  remove: async (id) => {
    const index = state.todos.findIndex((todo) => todo.id === id);
    if (index < 0) return false;
    state.todos.splice(index, 1);
    return true;
  },

  reorder: async (items) => {
    const existing = await todos.list();
    const byId = new Map(existing.map((todo) => [todo.id, todo]));
    const seen = new Set();
    const orderedIds = [];

    for (const item of items) {
      const id = typeof item === 'string' ? item : item?.id;
      if (!id || seen.has(id) || !byId.has(id)) continue;
      seen.add(id);
      orderedIds.push(id);
    }

    for (const todo of existing) {
      if (!seen.has(todo.id)) orderedIds.push(todo.id);
    }

    orderedIds.forEach((id, index) => {
      const row = state.todos.find((todo) => todo.id === id);
      if (row) row.sort_order = index;
    });

    return todos.list();
  },
};

module.exports = {
  repos: { notes, todos },
  reset,
};
