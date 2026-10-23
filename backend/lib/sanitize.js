const PRIORITIES = new Set(['low', 'medium', 'high']);

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
    completedAt: completed
      ? normalizeTimestamp(input.completedAt, base.completedAt ?? Date.now())
      : null,
  };
}

module.exports = {
  PRIORITIES,
  LIMITS,
  clampString,
  normalizeTags,
  normalizePriority,
  normalizeDueDate,
  normalizeTimestamp,
  sanitizeNote,
  sanitizeTodo,
};
