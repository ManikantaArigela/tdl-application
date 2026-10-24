/**
 * The single place where storage rows become API types.
 *
 * Supabase returns snake_case columns and ISO timestamps. The client contract
 * stays camelCase with epoch-millisecond timestamps, exactly as before the
 * database migration. Repositories must map rows through this file rather than
 * returning PostgREST data directly.
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

const toNoteDTO = (row = {}) => ({
  id: String(row.id ?? row._id ?? ''),
  title: typeof row.title === 'string' ? row.title : '',
  content: typeof row.content === 'string' ? row.content : '',
  tags: Array.isArray(row.tags) ? row.tags : [],
  pinned: Boolean(row.pinned),
  archived: Boolean(row.archived),
  createdAt: toMs(row.created_at ?? row.createdAt),
  updatedAt: toMs(row.updated_at ?? row.updatedAt),
});

const toTodoDTO = (row = {}) => ({
  id: String(row.id ?? row._id ?? ''),
  text: typeof row.text === 'string' ? row.text : '',
  priority: typeof row.priority === 'string' ? row.priority : 'medium',
  completed: Boolean(row.completed),
  dueDate:
    typeof (row.due_date ?? row.dueDate) === 'string' && (row.due_date ?? row.dueDate)
      ? row.due_date ?? row.dueDate
      : null,
  dueTime:
    typeof (row.due_time ?? row.dueTime) === 'string' && (row.due_time ?? row.dueTime)
      ? row.due_time ?? row.dueTime
      : null,
  repeat: typeof row.repeat === 'string' ? row.repeat : 'none',
  completedAt: toMs(row.completed_at ?? row.completedAt),
  createdAt: toMs(row.created_at ?? row.createdAt),
});

module.exports = { toMs, toNoteDTO, toTodoDTO };
