/**
 * The single place where storage documents become API types.
 *
 * MongoDB documents use `_id` and camelCase fields, while the in-memory test
 * repositories and any imported Supabase rows use snake_case. This mapping layer
 * accepts both so the HTTP contract stays stable: camelCase keys with
 * epoch-millisecond timestamps and no storage internals (no `_id`, `userId`).
 */

const toMs = (value) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
};

const pick = (doc, ...keys) => {
  for (const key of keys) {
    if (doc?.[key] !== undefined) return doc[key];
  }
  return undefined;
};

const toNoteDTO = (doc = {}) => ({
  id: String(pick(doc, '_id', 'id') ?? ''),
  title: typeof doc.title === 'string' ? doc.title : '',
  content: typeof doc.content === 'string' ? doc.content : '',
  tags: Array.isArray(doc.tags) ? doc.tags : [],
  pinned: Boolean(doc.pinned),
  archived: Boolean(doc.archived),
  createdAt: toMs(pick(doc, 'createdAt', 'created_at')),
  updatedAt: toMs(pick(doc, 'updatedAt', 'updated_at')),
});

const toTodoDTO = (doc = {}) => {
  const dueDate = pick(doc, 'dueDate', 'due_date');
  const dueTime = pick(doc, 'dueTime', 'due_time');

  return {
    id: String(pick(doc, '_id', 'id') ?? ''),
    text: typeof doc.text === 'string' ? doc.text : '',
    priority: typeof doc.priority === 'string' ? doc.priority : 'medium',
    completed: Boolean(doc.completed),
    dueDate: typeof dueDate === 'string' && dueDate ? dueDate : null,
    dueTime: typeof dueTime === 'string' && dueTime ? dueTime : null,
    repeat: typeof doc.repeat === 'string' ? doc.repeat : 'none',
    duration:
      typeof doc.duration === 'number' && Number.isFinite(doc.duration) ? doc.duration : null,
    completedAt: toMs(pick(doc, 'completedAt', 'completed_at')),
    createdAt: toMs(pick(doc, 'createdAt', 'created_at')),
  };
};

const toUserDTO = (doc = {}) => ({
  id: String(pick(doc, '_id', 'id') ?? ''),
  email: typeof doc.email === 'string' ? doc.email : '',
  name: typeof doc.name === 'string' ? doc.name : '',
  bio: typeof doc.bio === 'string' ? doc.bio : '',
  avatar: typeof doc.avatar === 'string' ? doc.avatar : '',
  createdAt: toMs(pick(doc, 'createdAt', 'created_at')),
});

module.exports = { toMs, toNoteDTO, toTodoDTO, toUserDTO };
