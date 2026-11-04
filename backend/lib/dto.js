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
  trashed: Boolean(doc.trashed),
  trashedAt: toMs(pick(doc, 'trashedAt', 'trashed_at')),
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
    trashed: Boolean(doc.trashed),
    trashedAt: toMs(pick(doc, 'trashedAt', 'trashed_at')),
    createdAt: toMs(pick(doc, 'createdAt', 'created_at')),
  };
};

const toReminderSettingsDTO = (doc = {}) => ({
  enabled: Boolean(doc.enabled),
  pushEnabled: doc.pushEnabled !== false,
  sipUri: typeof doc.sipUri === 'string' ? doc.sipUri : '',
  voiceLanguage: typeof doc.voiceLanguage === 'string' ? doc.voiceLanguage : 'en',
  timezone: typeof doc.timezone === 'string' && doc.timezone ? doc.timezone : 'UTC',
  quietStart: typeof doc.quietStart === 'string' ? doc.quietStart : '21:00',
  quietEnd: typeof doc.quietEnd === 'string' ? doc.quietEnd : '08:00',
  maxRetries: typeof doc.maxRetries === 'number' ? doc.maxRetries : 2,
  consentAt: toMs(doc.consentAt),
  sipVerified: Boolean(doc.sipVerifiedAt),
  sipVerifiedAt: toMs(doc.sipVerifiedAt),
});

const toReminderEventDTO = (doc = {}) => ({
  id: String(doc._id ?? doc.id ?? ''),
  todoId: String(doc.todoId ?? ''),
  stage: typeof doc.stage === 'string' ? doc.stage : '',
  channel: doc.channel === 'call' ? 'call' : 'push',
  status: typeof doc.status === 'string' ? doc.status : 'queued',
  attempt: Number(doc.attempt) || 0,
  scheduledFor: toMs(doc.scheduledFor),
  startedAt: toMs(doc.startedAt),
  endedAt: toMs(doc.endedAt),
  provider: typeof doc.provider === 'string' ? doc.provider : '',
  error: typeof doc.error === 'string' ? doc.error : '',
  createdAt: toMs(doc.createdAt),
});

const toUserDTO = (doc = {}) => ({
  id: String(pick(doc, '_id', 'id') ?? ''),
  email: typeof doc.email === 'string' ? doc.email : '',
  name: typeof doc.name === 'string' ? doc.name : '',
  bio: typeof doc.bio === 'string' ? doc.bio : '',
  avatar: typeof doc.avatar === 'string' ? doc.avatar : '',
  reminders: toReminderSettingsDTO(pick(doc, 'reminders') ?? {}),
  createdAt: toMs(pick(doc, 'createdAt', 'created_at')),
});

module.exports = {
  toMs,
  toNoteDTO,
  toTodoDTO,
  toReminderSettingsDTO,
  toReminderEventDTO,
  toUserDTO,
};
