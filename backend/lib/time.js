/**
 * Timezone helpers for server-side reminders.
 *
 * Todos store `dueDate` as a plain `YYYY-MM-DD` string and `dueTime` as a local
 * `HH:MM`, so the server must interpret them in the account's timezone. These
 * helpers use Intl only (no extra dependency) and are correct across DST
 * transitions: the offset is measured twice and the second pass wins.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;
const HAS_ZONE = /(?:z|[+-]\d{2}:?\d{2})$/i;

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Offset in milliseconds between `timeZone` and UTC at a given instant. */
function offsetAt(utcMs, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(utcMs));
  const map = {};
  for (const part of parts) map[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - utcMs;
}

/** Converts a wall-clock moment in `timeZone` to an epoch-millisecond instant. */
function zonedToUtc({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const first = offsetAt(guess, timeZone);
  let instant = guess - first;
  const second = offsetAt(instant, timeZone);
  if (second !== first) instant = guess - second;
  return instant;
}

function parseDueDateParts(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { instant: value };
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  const dateOnly = text.match(DATE_ONLY);
  if (dateOnly) {
    return {
      year: Number(dateOnly[1]),
      month: Number(dateOnly[2]),
      day: Number(dateOnly[3]),
    };
  }

  const local = text.match(LOCAL_DATETIME);
  if (local && !HAS_ZONE.test(text)) {
    return {
      year: Number(local[1]),
      month: Number(local[2]),
      day: Number(local[3]),
      hour: Number(local[4]),
      minute: Number(local[5]),
    };
  }

  const ms = Date.parse(text);
  return Number.isNaN(ms) ? null : { instant: ms };
}

/**
 * The instant a task is due. Date-only tasks default to 09:00 local, matching
 * the browser's `dueTimestamp` helper.
 */
function dueInstant({ dueDate, dueTime, timeZone, defaultTime = '09:00' }) {
  const parsed = parseDueDateParts(dueDate);
  if (!parsed) return null;

  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const fromDueTime = String(dueTime ?? '').match(/^(\d{1,2}):(\d{2})$/);
  const hasDueTime =
    fromDueTime &&
    Number(fromDueTime[1]) <= 23 &&
    Number(fromDueTime[2]) <= 59;

  // Some todos are created with a full ISO timestamp in dueDate *and* a
  // separate local dueTime. The explicit dueTime is what the user picked, so
  // it must win; only use the timestamp's date part.
  if (parsed.instant !== undefined && !hasDueTime) return parsed.instant;

  let year;
  let month;
  let day;
  if (parsed.instant !== undefined) {
    const key = localDateKey(parsed.instant, zone);
    [year, month, day] = key.split('-').map(Number);
  } else {
    year = parsed.year;
    month = parsed.month;
    day = parsed.day;
  }

  let hour;
  let minute;
  if (hasDueTime) {
    hour = Number(fromDueTime[1]);
    minute = Number(fromDueTime[2]);
  } else if (parsed.hour !== undefined) {
    hour = parsed.hour;
    minute = parsed.minute;
  } else {
    const [fallbackHour, fallbackMinute] = String(defaultTime)
      .split(':')
      .map((part) => Number(part));
    hour = Number.isFinite(fallbackHour) ? fallbackHour : 9;
    minute = Number.isFinite(fallbackMinute) ? fallbackMinute : 0;
  }

  return zonedToUtc({ year, month, day, hour, minute }, zone);
}

/** Local calendar date key (`YYYY-MM-DD`) for an instant. */
function localDateKey(ms, timeZone) {
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(ms));
}

/** Local minutes since midnight for an instant. */
function localMinutes(ms, timeZone) {
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  });
  const [hour, minute] = formatter.format(new Date(ms)).split(':').map(Number);
  return hour * 60 + minute;
}

function clockToMinutes(value, fallback) {
  const match = String(value ?? '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

/**
 * Quiet hours wrap midnight by default (21:00 → 08:00). Equal bounds mean
 * "never quiet".
 */
function isQuietHours(ms, timeZone, start = '21:00', end = '08:00') {
  const from = clockToMinutes(start, 21 * 60);
  const to = clockToMinutes(end, 8 * 60);
  if (from === to) return false;
  const now = localMinutes(ms, timeZone);
  if (from < to) return now >= from && now < to;
  return now >= from || now < to;
}

/** Midnight (00:00) of the local day containing `ms`, as an instant. */
function startOfLocalDay(ms, timeZone) {
  const key = localDateKey(ms, timeZone);
  const [year, month, day] = key.split('-').map(Number);
  return zonedToUtc({ year, month, day, hour: 0, minute: 0 }, timeZone);
}

/** Adds whole minutes to an instant. */
const addMinutes = (ms, minutes) => ms + Number(minutes || 0) * 60_000;

module.exports = {
  isValidTimeZone,
  offsetAt,
  zonedToUtc,
  dueInstant,
  localDateKey,
  localMinutes,
  clockToMinutes,
  isQuietHours,
  startOfLocalDay,
  addMinutes,
};
