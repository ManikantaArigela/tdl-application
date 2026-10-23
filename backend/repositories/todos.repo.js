const crypto = require('crypto');

const Todo = require('../models/todo');
const { sanitizeTodo } = require('../lib/sanitize');
const { toTodoDTO } = require('../lib/dto');

const SORT = { order: 1, createdAt: 1, _id: 1 };

const list = async () => {
  const docs = await Todo.find().sort(SORT).lean();
  return docs.map(toTodoDTO);
};

/** Numbers in the DTO are converted back to Dates at the storage boundary. */
const toDoc = (todo) => ({
  text: todo.text,
  priority: todo.priority,
  completed: todo.completed,
  dueDate: todo.dueDate,
  completedAt: todo.completedAt === null ? null : new Date(todo.completedAt),
});

/**
 * New todos sort to the top without shifting every other document: we take the
 * lowest current order and step one below it.
 */
const nextTopOrder = async () => {
  const first = await Todo.findOne().sort({ order: 1 }).select('order').lean();
  return first ? first.order - 1 : 0;
};

const create = async (input = {}) => {
  const todo = sanitizeTodo(input);
  if (!todo.text) return { ok: false, reason: 'invalid' };

  const doc = await Todo.create({
    _id: `t_${crypto.randomUUID()}`,
    ...toDoc(todo),
    createdAt: new Date(),
    order: await nextTopOrder(),
  });

  return { ok: true, todo: toTodoDTO(doc.toObject()) };
};

const update = async (id, input = {}) => {
  const existing = await Todo.findById(id).lean();
  if (!existing) return { ok: false, reason: 'not_found' };

  const next = sanitizeTodo(input, toTodoDTO(existing));
  if (!next.text) return { ok: false, reason: 'invalid' };

  const updated = await Todo.findOneAndUpdate(
    { _id: id },
    { $set: toDoc(next) },
    { new: true, lean: true }
  );
  if (!updated) return { ok: false, reason: 'not_found' };

  return { ok: true, todo: toTodoDTO(updated) };
};

const remove = async (id) => {
  const result = await Todo.deleteOne({ _id: id });
  return result.deletedCount > 0;
};

/**
 * Mirrors the file-store contract: ids the client sent (deduped, existing only)
 * come first, then every record it did not send, in current order. Records are
 * never dropped. One bulkWrite sets the new positions; the canonical list is
 * re-read afterwards so a racing client converges instead of assuming.
 */
const reorder = async (items) => {
  const existing = await Todo.find().sort(SORT).lean();
  const byId = new Map(existing.map((todo) => [todo._id, todo]));
  const seen = new Set();
  const orderedIds = [];

  for (const item of items) {
    const id = typeof item === 'string' ? item : item?.id;
    if (!id || seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    orderedIds.push(id);
  }

  for (const todo of existing) {
    if (!seen.has(todo._id)) orderedIds.push(todo._id);
  }

  if (orderedIds.length > 0) {
    await Todo.bulkWrite(
      orderedIds.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
      })),
      { ordered: false }
    );
  }

  return list();
};

module.exports = { list, create, update, remove, reorder };
