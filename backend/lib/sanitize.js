const PRIORITIES = new Set(['low', 'medium', 'high']);
const REPEATS = new Set(['none', 'daily', 'weekly']);

const LIMITS = {
  title: 300,
  content: 100_000,
  todo: 1_000,
  tags: 12,
};

const clampString = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

const normalizeTags = (value) => {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((tag) => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  ].slice(0, LIMITS.tags);
};

const normalizePriority = (value, fallback = 'medium') =>
  PRIORITIES.has(value) ? value : fallback;

const normalizeRepeat = (value, fallback = 'none') =>
  REPEATS.has(value) ? value : fallback;

/** Accepts a 24h "H:MM" or "HH:MM" clock string; anything else falls back. */
const normalizeTime = (value, fallback = null) => {
  if (value === undefined) return fallback;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return `${`${hours}`.padStart(2, '0')}:${match[2]}`;
};

const normalizeDueDate = (value, fallback = null) => {
  if (value === undefined) return fallback;
  if (value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  return fallback;
};

const normalizeTimestamp = (value, fallback = null) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function sanitizeNote(input = {}, base = {}) {
  return {
    title: input.title !== undefined ? clampString(input.title, LIMITS.title) : base.title ?? '',
    content:
      input.content !== undefined ? clampString(input.content, LIMITS.content) : base.content ?? '',
    tags: input.tags !== undefined ? normalizeTags(input.tags) : base.tags ?? [],
    pinned: input.pinned !== undefined ? Boolean(input.pinned) : base.pinned ?? false,
    archived: input.archived !== undefined ? Boolean(input.archived) : base.archived ?? false,
  };
}

function sanitizeTodo(input = {}, base = {}) {
  const completed =
    input.completed !== undefined ? Boolean(input.completed) : base.completed ?? false;
  return {
    // Without a trim, "" would pass the route check and fail the schema.
    text: (input.text !== undefined ? clampString(input.text, LIMITS.todo) : base.text ?? '').trim(),
    priority:
      input.priority !== undefined
        ? normalizePriority(input.priority, base.priority)
        : base.priority ?? 'medium',
    completed,
    dueDate: normalizeDueDate(input.dueDate, base.dueDate ?? null),
    dueTime: normalizeTime(input.dueTime, base.dueTime ?? null),
    repeat:
      input.repeat !== undefined ? normalizeRepeat(input.repeat, base.repeat) : base.repeat ?? 'none',
    completedAt: completed
      ? normalizeTimestamp(input.completedAt, base.completedAt ?? Date.now())
      : null,
  };
}

module.exports = {
  PRIORITIES,
  REPEATS,
  LIMITS,
  clampString,
  normalizeTags,
  normalizePriority,
  normalizeRepeat,
  normalizeTime,
  normalizeDueDate,
  normalizeTimestamp,
  sanitizeNote,
  sanitizeTodo,
};
