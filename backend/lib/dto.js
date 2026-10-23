/**
 * The single place where storage types become API types.
 *
 * Mongoose documents are never sent to clients: `.lean()` results bypass schema
 * `toJSON` transforms, so shapes must be guaranteed here instead of in the model.
 */

const toMs = (value) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

const toNoteDTO = (doc = {}) => ({
  id: String(doc._id ?? ''),
  title: typeof doc.title === 'string' ? doc.title : '',
  content: typeof doc.content === 'string' ? doc.content : '',
  tags: Array.isArray(doc.tags) ? doc.tags : [],
  pinned: Boolean(doc.pinned),
  archived: Boolean(doc.archived),
  createdAt: toMs(doc.createdAt),
  updatedAt: toMs(doc.updatedAt),
});

const toTodoDTO = (doc = {}) => ({
  id: String(doc._id ?? ''),
  text: typeof doc.text === 'string' ? doc.text : '',
  priority: typeof doc.priority === 'string' ? doc.priority : 'medium',
  completed: Boolean(doc.completed),
  dueDate: typeof doc.dueDate === 'string' && doc.dueDate ? doc.dueDate : null,
  completedAt: toMs(doc.completedAt),
  createdAt: toMs(doc.createdAt),
});

module.exports = { toMs, toNoteDTO, toTodoDTO };
