const PRIORITIES = new Set(['low', 'medium', 'high']);
const REPEATS = new Set(['none', 'daily', 'weekly']);

/** Voice reminder options. `en-hi` is a bilingual prompt. */
const VOICE_LANGUAGES = new Set(['en', 'hi', 'te', 'en-hi']);

const LIMITS = {
  title: 300,
  content: 100_000,
  todo: 1_000,
  tags: 12,
  sipUri: 254,
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

/** Task duration in whole minutes; null/"" clears it. */
const normalizeDuration = (value, fallback = null) => {
  if (value === undefined) return fallback;
  if (value === null || value === '') return null;
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return fallback;
  return Math.min(600, Math.max(0, Math.round(minutes)));
};

/** Editable profile fields. Unknown avatar ids fall back to ''. */
const AVATAR_PATTERN = /^[a-z0-9-]{1,64}$/;

const SIP_URI_PATTERN = /^[a-z0-9][a-z0-9._+-]{1,63}@[a-z0-9.-]+\.[a-z]{2,}$/i;

const isValidSipUri = (value) =>
  typeof value === 'string' &&
  value.length <= LIMITS.sipUri &&
  SIP_URI_PATTERN.test(value.trim());

const normalizeVoiceLanguage = (value, fallback = 'en') =>
  VOICE_LANGUAGES.has(value) ? value : fallback;

const DEFAULT_REMINDERS = {
  enabled: false,
  pushEnabled: true,
  sipUri: '',
  voiceLanguage: 'en',
  timezone: 'UTC',
  quietStart: '21:00',
  quietEnd: '08:00',
  maxRetries: 2,
  consentAt: null,
};

/**
 * Reminder settings are account-level, not device-level. Verification state is
 * server-managed and is never accepted from the client.
 */
function sanitizeReminderSettings(input = {}, base = {}) {
  const current = { ...DEFAULT_REMINDERS, ...base };
  const sipInput = input.sipUri !== undefined ? input.sipUri : current.sipUri;
  const sipUri = typeof sipInput === 'string' ? sipInput.trim().toLowerCase().slice(0, LIMITS.sipUri) : '';

  const retries = Number(input.maxRetries ?? current.maxRetries);
  const timezone =
    typeof input.timezone === 'string' && input.timezone.trim()
      ? input.timezone.trim().slice(0, 64)
      : current.timezone;

  const enabled = input.enabled !== undefined ? Boolean(input.enabled) : Boolean(current.enabled);
  const consentAt =
    input.consent === true
      ? Number(current.consentAt) || Date.now()
      : input.consent === false
        ? null
        : current.consentAt ?? null;

  return {
    enabled,
    pushEnabled:
      input.pushEnabled !== undefined ? Boolean(input.pushEnabled) : current.pushEnabled !== false,
    sipUri: isValidSipUri(sipUri) ? sipUri : '',
    voiceLanguage:
      input.voiceLanguage !== undefined
        ? normalizeVoiceLanguage(input.voiceLanguage, current.voiceLanguage)
        : current.voiceLanguage,
    timezone,
    quietStart: normalizeTime(input.quietStart, current.quietStart) ?? '21:00',
    quietEnd: normalizeTime(input.quietEnd, current.quietEnd) ?? '08:00',
    maxRetries: Number.isFinite(retries) ? Math.min(3, Math.max(0, Math.round(retries))) : 2,
    consentAt,
  };
}

function sanitizeProfile(input = {}, base = {}) {
  return {
    name:
      input.name !== undefined
        ? clampString(input.name, 80).trim()
        : (base.name ?? '').toString(),
    bio: input.bio !== undefined ? clampString(input.bio, 280) : (base.bio ?? '').toString(),
    avatar:
      input.avatar !== undefined
        ? (typeof input.avatar === 'string' && AVATAR_PATTERN.test(input.avatar.trim())
            ? input.avatar.trim()
            : '')
        : (base.avatar ?? '').toString(),
  };
}

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
    duration: normalizeDuration(input.duration, base.duration ?? null),
    completedAt: completed
      ? normalizeTimestamp(input.completedAt, base.completedAt ?? Date.now())
      : null,
  };
}

module.exports = {
  PRIORITIES,
  REPEATS,
  VOICE_LANGUAGES,
  LIMITS,
  DEFAULT_REMINDERS,
  clampString,
  normalizeTags,
  normalizePriority,
  normalizeRepeat,
  normalizeTime,
  normalizeDueDate,
  normalizeTimestamp,
  normalizeDuration,
  AVATAR_PATTERN,
  SIP_URI_PATTERN,
  isValidSipUri,
  normalizeVoiceLanguage,
  sanitizeProfile,
  sanitizeReminderSettings,
  sanitizeNote,
  sanitizeTodo,
};
