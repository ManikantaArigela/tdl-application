const crypto = require('crypto');

const Todo = require('../models/todo');
const { sanitizeTodo } = require('../lib/sanitize');
const { toTodoDTO } = require('../lib/dto');

const SORT = { sortOrder: 1, createdAt: 1, _id: 1 };

/** API timestamps are epoch milliseconds; MongoDB stores Dates. */
const toDoc = (todo) => ({
  text: todo.text,
  priority: todo.priority,
  completed: todo.completed,
  dueDate: todo.dueDate,
  dueTime: todo.dueTime,
  repeat: todo.repeat,
  duration: todo.duration === null ? null : todo.duration,
  completedAt: todo.completedAt === null ? null : new Date(todo.completedAt),
});

/**
 * Todos repository bound to one signed-in account. Same contract as the
 * previous storage layer: list/create/update/remove/reorder.
 */
function createTodosRepo({ userId } = {}) {
  if (!userId) throw new Error('createTodosRepo requires a user id');

  const list = async () => {
    const docs = await Todo.find({ userId }).sort(SORT).lean();
    return docs.map(toTodoDTO);
  };

  /**
   * New todos sort to the top without shifting every document: take the lowest
   * current order for this user and step one below it.
   */
  const nextTopOrder = async () => {
    const first = await Todo.findOne({ userId }).sort({ sortOrder: 1 }).select('sortOrder').lean();
    return first ? Number(first.sortOrder) - 1 : 0;
  };

  const create = async (input = {}) => {
    const todo = sanitizeTodo(input);
    if (!todo.text) return { ok: false, reason: 'invalid' };

    const doc = await Todo.create({
      _id: `t_${crypto.randomUUID()}`,
      userId,
      ...toDoc(todo),
      createdAt: new Date(),
      sortOrder: await nextTopOrder(),
    });

    return { ok: true, todo: toTodoDTO(doc.toObject()) };
  };

  const update = async (id, input = {}) => {
    const existing = await Todo.findOne({ _id: id, userId }).lean();
    if (!existing) return { ok: false, reason: 'not_found' };

    const next = sanitizeTodo(input, toTodoDTO(existing));
    if (!next.text) return { ok: false, reason: 'invalid' };

    const updated = await Todo.findOneAndUpdate(
      { _id: id, userId },
      { $set: toDoc(next) },
      { new: true, lean: true }
    );

    if (!updated) return { ok: false, reason: 'not_found' };
    return { ok: true, todo: toTodoDTO(updated) };
  };

  const remove = async (id) => {
    const result = await Todo.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  };

  /**
   * Mirrors the API contract: ids the client sent (deduped, existing only) come
   * first, then every record it did not send, in current order. Records are
   * never dropped. The canonical list is re-read afterwards so a racing client
   * converges instead of assuming.
   */
  const reorder = async (items) => {
    const existing = await Todo.find({ userId }).sort(SORT).lean();
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
          updateOne: {
            filter: { _id: id, userId },
            update: { $set: { sortOrder: index } },
          },
        })),
        { ordered: false }
      );
    }

    return list();
  };

  return { list, create, update, remove, reorder };
}

module.exports = { createTodosRepo };
