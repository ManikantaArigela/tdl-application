const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Date-only strings (YYYY-MM-DD) are parsed as local dates. `new Date('2026-10-25')`
 * is UTC midnight, which renders as the previous day in western timezones.
 */
function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`;
}

/** Formats a 24h "HH:MM" clock string using the visitor's locale. */
export function formatDueTime(value) {
  if (typeof value !== 'string') return '';
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return '';
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return timeFormatter.format(date);
}

/** Absolute timestamp for a task's due date + optional time (09:00 fallback). */
export function dueTimestamp(todo) {
  if (!todo?.dueDate) return null;
  const date = toDate(todo.dueDate);
  if (Number.isNaN(date.getTime())) return null;
  const [hours, minutes] = (todo.dueTime || '09:00').split(':').map(Number);
  date.setHours(
    Number.isFinite(hours) ? hours : 9,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  );
  return date.getTime();
}

/** Rolls a recurring task forward from its current due date (or today). */
export function advanceDueDate(dueDate, repeat) {
  const base = dueDate ? toDate(dueDate) : new Date();
  const next = new Date(base);
  if (repeat === 'daily') next.setDate(next.getDate() + 1);
  else if (repeat === 'weekly') next.setDate(next.getDate() + 7);
  else return dueDate ?? null;
  next.setHours(12, 0, 0, 0);
  return next.toISOString();
}

export function relativeTime(value) {
  if (!value) return '—';
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.round(seconds / 86400)}d ago`;
  return dateFormatter.format(date);
}

export function dayKey(value) {
  const date = toDate(value);
  date.setHours(0, 0, 0, 0);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The last seven days, oldest first, ending today. */
export function lastSevenDays() {
  const days = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - 6);

  for (let i = 0; i < 7; i += 1) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() + i);
    days.push({
      key: dayKey(date),
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      fullLabel: date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
      date,
    });
  }
  return days;
}

export function isOverdue(value) {
  if (!value) return false;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return date.getTime() < endOfToday.getTime() && dayKey(date) !== dayKey(new Date());
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}
