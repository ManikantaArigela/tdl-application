#!/usr/bin/env node
/**
 * Imports notes and todos from JSON into MongoDB for one account.
 *
 * This is the migration path from Supabase (or the old JSON store). Export the
 * two tables as JSON arrays, sign up in the app so the destination account
 * exists, then run:
 *
 *   node --env-file=.env scripts/import-data.js \
 *     --email you@example.com --notes notes.json --todos todos.json
 *
 * Options:
 *   --email EMAIL     destination MongoDB account (required)
 *   --notes PATH      JSON array of notes (default: data/notes.json)
 *   --todos PATH      JSON array of todos (default: data/todos.json)
 *   --dry-run         validate and report without writing
 *   --replace         delete this account's documents that are not in the files
 *   --yes             required together with --replace
 *
 * Records are upserted by their existing id, so the import is idempotent.
 * Supabase snake_case rows and camelCase JSON both work.
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const db = require('../db');
const Note = require('../models/note');
const Todo = require('../models/todo');
const User = require('../models/user');
const { sanitizeNote, sanitizeTodo } = require('../lib/sanitize');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const email = String(option('--email', '')).trim().toLowerCase();
const notesPath = path.resolve(option('--notes', path.join(__dirname, '..', 'data', 'notes.json')));
const todosPath = path.resolve(option('--todos', path.join(__dirname, '..', 'data', 'todos.json')));
const dryRun = flag('--dry-run');
const replace = flag('--replace');
const confirmed = flag('--yes');

const toDate = (value, fallback) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string' && value && !Number.isNaN(Date.parse(value))) {
    return new Date(value);
  }
  return fallback;
};

async function readArray(file) {
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`- ${file}: not found, skipping`);
      return [];
    }
    throw error;
  }

  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`${file}: expected a JSON array`);
  return parsed;
}

function noteDoc(record, userId, index) {
  if (!record || typeof record !== 'object') throw new Error(`notes[${index}]: not an object`);

  const now = new Date();
  const sourceId = record.id ?? record._id;
  const id = typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : `n_${crypto.randomUUID()}`;
  const note = sanitizeNote({
    title: record.title,
    content: record.content,
    tags: record.tags,
    pinned: record.pinned,
    archived: record.archived,
  });

  return {
    _id: id,
    userId,
    ...note,
    createdAt: toDate(record.createdAt ?? record.created_at, now),
    updatedAt: toDate(record.updatedAt ?? record.updated_at, now),
  };
}

function todoDoc(record, userId, index) {
  if (!record || typeof record !== 'object') throw new Error(`todos[${index}]: not an object`);

  const now = new Date();
  const completedAtSource = record.completedAt ?? record.completed_at;
  const completedAtMs = completedAtSource ? toDate(completedAtSource, null)?.getTime() ?? null : null;
  const todo = sanitizeTodo({
    text: record.text,
    priority: record.priority,
    completed: record.completed,
    dueDate: record.dueDate ?? record.due_date,
    dueTime: record.dueTime ?? record.due_time,
    repeat: record.repeat,
    completedAt: completedAtMs,
  });
  if (!todo.text) throw new Error(`todos[${index}]: text is empty`);

  const sourceId = record.id ?? record._id;
  const id = typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : `t_${crypto.randomUUID()}`;
  const sortOrder = record.sortOrder ?? record.sort_order ?? record.order;

  return {
    _id: id,
    userId,
    text: todo.text,
    priority: todo.priority,
    completed: todo.completed,
    dueDate: todo.dueDate,
    dueTime: todo.dueTime,
    repeat: todo.repeat,
    completedAt: todo.completed ? toDate(todo.completedAt, now) : null,
    createdAt: toDate(record.createdAt ?? record.created_at, now),
    sortOrder: Number.isInteger(sortOrder) ? sortOrder : index,
  };
}

async function upsert(Model, docs, label) {
  if (docs.length === 0) return 0;

  const operations = docs.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: doc },
      upsert: true,
    },
  }));
  const result = await Model.bulkWrite(operations, { ordered: false });
  console.log(
    `${label}: ${result.upsertedCount} inserted, ${result.modifiedCount} updated, ` +
      `${result.matchedCount} matched`
  );
  return result.upsertedCount + result.modifiedCount;
}

async function main() {
  if (!email) {
    console.error('--email is required (the account created in the app).');
    process.exitCode = 1;
    return;
  }

  const [notesRaw, todosRaw] = await Promise.all([readArray(notesPath), readArray(todosPath)]);
  console.log(`Reading ${notesRaw.length} note(s) and ${todosRaw.length} todo(s).`);

  if (dryRun) {
    console.log('Dry run: files parsed successfully; nothing written.');
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Use node --env-file=.env.');

  await db.connect(uri);
  console.log(`Connected to ${db.maskUri(uri)}`);

  const user = await User.findOne({ email }).lean();
  if (!user) {
    throw new Error(
      `No MongoDB account for ${email}. Sign up in the app first, then run this import.`
    );
  }

  const userId = String(user._id);
  const notes = notesRaw.map((record, index) => noteDoc(record, userId, index));
  const todos = todosRaw.map((record, index) => todoDoc(record, userId, index));

  // Ids are global in MongoDB. Refuse to steal a document that already belongs
  // to a different account instead of silently reassigning it.
  const [noteConflicts, todoConflicts] = await Promise.all([
    Note.countDocuments({ _id: { $in: notes.map((n) => n._id) }, userId: { $ne: userId } }),
    Todo.countDocuments({ _id: { $in: todos.map((t) => t._id) }, userId: { $ne: userId } }),
  ]);
  if (noteConflicts > 0 || todoConflicts > 0) {
    throw new Error(
      `${noteConflicts + todoConflicts} id(s) already belong to another account. ` +
        'Import each Supabase user into a different MongoDB account only once.'
    );
  }

  await upsert(Note, notes, 'notes');
  await upsert(Todo, todos, 'todos');

  if (replace) {
    if (!confirmed) throw new Error('--replace requires --yes. Nothing was deleted.');
    const removedNotes = await Note.deleteMany({ userId, _id: { $nin: notes.map((n) => n._id) } });
    const removedTodos = await Todo.deleteMany({ userId, _id: { $nin: todos.map((t) => t._id) } });
    console.log(
      `Removed ${removedNotes.deletedCount} note(s) and ${removedTodos.deletedCount} todo(s) not present in the files.`
    );
  }

  const [noteCount, todoCount] = await Promise.all([
    Note.countDocuments({ userId }),
    Todo.countDocuments({ userId }),
  ]);
  console.log(`Done. ${email} now has ${noteCount} note(s) and ${todoCount} todo(s).`);
}

main()
  .catch((error) => {
    console.error(`Import failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.disconnect();
  });
