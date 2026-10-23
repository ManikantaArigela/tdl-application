#!/usr/bin/env node
/**
 * One-shot import of the legacy JSON store into MongoDB.
 *
 *   node scripts/import-json.js [--data-dir DIR] [--dry-run] [--batch N]
 *                               [--replace --yes] [--verbose]
 *
 * Idempotent: records are upserted by their existing string id, so running it
 * twice converges instead of duplicating. It never deletes unless --replace is
 * passed together with --yes, and it backs the JSON files up first.
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const db = require('../db');
const Note = require('../models/note');
const Todo = require('../models/todo');
const { sanitizeNote, sanitizeTodo } = require('../lib/sanitize');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const dataDir = path.resolve(option('--data-dir', path.join(__dirname, '..', 'data')));
const batchSize = Math.max(1, Number(option('--batch', '500')) || 500);
const dryRun = flag('--dry-run');
const verbose = flag('--verbose');
const replace = flag('--replace');
const confirmed = flag('--yes');

const toDate = (value, fallback) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value);
  return fallback;
};

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

async function readCollection(file) {
  const fullPath = path.join(dataDir, file);
  let raw;
  try {
    raw = await fs.readFile(fullPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`- ${file}: not found, skipping`);
      return null;
    }
    throw error;
  }

  if (!raw.trim()) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${file}: invalid JSON (${error.message})`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${file}: expected a JSON array, got ${typeof parsed}`);
  }
  return parsed;
}

function normalizeNote(record, index) {
  if (!record || typeof record !== 'object') return { error: 'record is not an object' };

  const now = new Date();
  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : `n_${crypto.randomUUID()}`;

  return {
    doc: {
      ...sanitizeNote(record),
      createdAt: toDate(record.createdAt, now),
      updatedAt: toDate(record.updatedAt, toDate(record.createdAt, now)),
    },
    id,
    generated: id !== record.id,
    index,
  };
}

function normalizeTodo(record, index) {
  if (!record || typeof record !== 'object') return { error: 'record is not an object' };

  const now = new Date();
  const sanitized = sanitizeTodo(record);
  if (!sanitized.text) return { error: 'text is empty' };

  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : `t_${crypto.randomUUID()}`;

  const completedAt = sanitized.completed
    ? toDate(sanitized.completedAt, now)
    : null;

  return {
    doc: {
      text: sanitized.text,
      priority: sanitized.priority,
      completed: sanitized.completed,
      dueDate: sanitized.dueDate,
      completedAt,
      createdAt: toDate(record.createdAt, now),
      // Source array position is the canonical order.
      order: Number.isInteger(record.order) ? record.order : index,
    },
    id,
    generated: id !== record.id,
    index,
  };
}

async function backup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dataDir, `.backup-${stamp}`);
  await fs.mkdir(target, { recursive: true });

  for (const file of ['notes.json', 'todos.json']) {
    try {
      await fs.copyFile(path.join(dataDir, file), path.join(target, file));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return target;
}

async function upsertAll(Model, entries, label) {
  let written = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const operations = batch.map((entry) => ({
      updateOne: {
        filter: { _id: entry.id },
        update: { $set: entry.doc },
        upsert: true,
      },
    }));

    if (!dryRun) {
      const result = await Model.bulkWrite(operations, { ordered: false });
      written += (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0) + (result.matchedCount ?? 0);
    } else {
      written += batch.length;
    }

    if (verbose) console.log(`  ${label}: ${Math.min(i + batchSize, entries.length)}/${entries.length}`);
  }

  return written;
}

async function main() {
  console.log(`Importing from ${dataDir}${dryRun ? ' (dry run)' : ''}`);

  const [notesRaw, todosRaw] = await Promise.all([
    readCollection('notes.json'),
    readCollection('todos.json'),
  ]);

  const notes = [];
  const todos = [];
  const invalid = [];

  (notesRaw ?? []).forEach((record, index) => {
    const result = normalizeNote(record, index);
    if (result.error) invalid.push(`notes[${index}]: ${result.error}`);
    else notes.push(result);
  });

  (todosRaw ?? []).forEach((record, index) => {
    const result = normalizeTodo(record, index);
    if (result.error) invalid.push(`todos[${index}]: ${result.error}`);
    else todos.push(result);
  });

  if (invalid.length > 0) {
    console.error(`\n${invalid.length} invalid record(s):`);
    invalid.slice(0, 25).forEach((line) => console.error(`  - ${line}`));
    if (invalid.length > 25) console.error(`  … ${invalid.length - 25} more`);
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${notes.length} note(s), ${todos.length} todo(s).`);
  const generated = [...notes, ...todos].filter((entry) => entry.generated).length;
  if (generated > 0) console.warn(`! ${generated} record(s) had no id and will get a new one.`);

  if (dryRun) {
    console.log('Dry run: nothing written.');
    notes.slice(0, 3).forEach((n) => console.log(`  note ${n.id} "${n.doc.title.slice(0, 40)}"`));
    todos.slice(0, 3).forEach((t) => console.log(`  todo ${t.id} [${t.doc.order}] "${t.doc.text}"`));
    return;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nova_notes';
  await db.connect(uri);
  console.log(`Connected to MongoDB (${uri.replace(/\/\/[^@]*@/, '//***@')})`);

  const backupDir = await backup();
  console.log(`Backup written to ${backupDir}`);

  const writtenNotes = await upsertAll(Note, notes, 'notes');
  const writtenTodos = await upsertAll(Todo, todos, 'todos');

  if (replace) {
    if (!confirmed) {
      console.error('--replace requires --yes. Nothing was deleted.');
      process.exitCode = 1;
      return;
    }
    const noteIds = notes.map((entry) => entry.id);
    const todoIds = todos.map((entry) => entry.id);
    const removedNotes = await Note.deleteMany({ _id: { $nin: noteIds } });
    const removedTodos = await Todo.deleteMany({ _id: { $nin: todoIds } });
    console.log(
      `Removed ${removedNotes.deletedCount} note(s) and ${removedTodos.deletedCount} todo(s) absent from JSON.`
    );
  }

  // Reconcile by source id: extra documents in the DB are legitimate.
  const [foundNotes, foundTodos] = await Promise.all([
    Note.countDocuments({ _id: { $in: notes.map((entry) => entry.id) } }),
    Todo.countDocuments({ _id: { $in: todos.map((entry) => entry.id) } }),
  ]);

  console.log(`\nWritten: ${writtenNotes} note op(s), ${writtenTodos} todo op(s).`);
  console.log(`Present: ${foundNotes}/${notes.length} notes, ${foundTodos}/${todos.length} todos.`);

  if (foundNotes !== notes.length || foundTodos !== todos.length) {
    console.error('Reconciliation failed.');
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`Import failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!dryRun) await db.disconnect();
  });
