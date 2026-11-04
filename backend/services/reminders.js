const crypto = require('crypto');

const { createRepos } = require('../repositories');
const { createReminderEventsRepo } = require('../repositories/reminder-events.repo');
const { scheduler } = require('../repositories/scheduler.repo');
const { users } = require('../repositories/users.repo');
const {
  dueInstant,
  localDateKey,
  isValidTimeZone,
  isQuietHours,
  startOfLocalDay,
  addMinutes,
} = require('../lib/time');
const { sanitizeReminderSettings, isValidSipUri } = require('../lib/sanitize');
const { toReminderSettingsDTO, toReminderEventDTO, toUserDTO } = require('../lib/dto');
const voice = require('../lib/voice');
const push = require('./push');

const events = createReminderEventsRepo();

const PUSH_STAGES = [
  { stage: 'push_30', offsetMinutes: -30 },
  { stage: 'push_10', offsetMinutes: -10 },
];
// Push is cheap but stale: only send a stage within two minutes of its ideal
// moment. Calls get a wider window so a task created just before it is due
// still rings.
const PUSH_GRACE_MS = 2 * 60 * 1000;
const CALL_GRACE_MS = 10 * 60 * 1000;
const RETRY_DELAY_MINUTES = Number(process.env.VOICE_RETRY_MINUTES) || 5;
const MAX_CALLS_PER_DAY = Number(process.env.MAX_CALLS_PER_USER_PER_DAY) || 6;
const SCHEDULER_BATCH_SIZE = Number(process.env.SCHEDULER_BATCH_SIZE) || 25;
const VERIFY_TTL_MS = 10 * 60 * 1000;
const VERIFY_COOLDOWN_MS = 60 * 1000;
const VERIFY_MAX_ATTEMPTS = 5;

const httpError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const settingsOf = (user) => toReminderSettingsDTO(user?.reminders || {});

const timezoneOf = (user) => {
  const timezone = user?.reminders?.timezone;
  return isValidTimeZone(timezone) ? timezone : 'UTC';
};

const dueKeyFor = (todo) => `${todo._id || todo.id}|${todo.dueDate || ''}|${todo.dueTime || ''}`;

const LOCALES = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', 'en-hi': 'en-IN' };

function formatDueForSpeech(todo, timezone, language) {
  const due = dueInstant({
    dueDate: todo.dueDate,
    dueTime: todo.dueTime,
    timeZone: timezone,
  });
  if (due === null) return '';
  try {
    return new Intl.DateTimeFormat(LOCALES[language] || 'en-IN', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(due));
  } catch {
    return '';
  }
}

function buildPrompt({ user, todo, language = 'en' }) {
  const name = String(user?.name || '').trim().split(/\s+/)[0] || 'there';
  const text = String(todo?.text || 'Your task').trim().slice(0, 160);
  const when = formatDueForSpeech(todo, timezoneOf(user), language);

  const english =
    `Hello ${name}. This is Nova. Reminder: ${text}.` +
    (when ? ` It is due ${when}.` : '') +
    ' Press 1 to mark it complete. Press 2 to snooze for 15 minutes. Press 9 to stop all voice reminders.';

  const hindi =
    `नमस्ते ${name}। यह Nova है। याद दिलाना: ${text}।` +
    ' पूरा करने के लिए 1 दबाएँ। पंद्रह मिनट टालने के लिए 2 दबाएँ। सभी कॉल बंद करने के लिए 9 दबाएँ।';

  const telugu =
    `నమస్కారం ${name}. ఇది Nova. గుర్తు చేయడం: ${text}.` +
    ' పూర్తి చేయడానికి 1 నొక్కండి. పదిహేను నిమిషాలు వాయిదా వేయడానికి 2 నొక్కండి. అన్ని కాల్స్ ఆపడానికి 9 నొక్కండి.';

  if (language === 'hi') return hindi;
  if (language === 'te') return telugu;
  if (language === 'en-hi') return `${english} ${hindi}`;
  return english;
}

function verificationScript(code) {
  const spaced = String(code).split('').join(' ');
  return `This is Nova. Your verification code is ${spaced}. I repeat: ${spaced}. Enter this code in the app to confirm this SIP address.`;
}

/** Creates the push and call moments for one todo. Duplicate rows are ignored. */
async function enqueueForTodo({ user, todo, now = Date.now() }) {
  const settings = settingsOf(user);
  const timezone = timezoneOf(user);
  const due = dueInstant({
    dueDate: todo.dueDate,
    dueTime: todo.dueTime,
    timeZone: timezone,
  });
  if (due === null) return 0;

  const dueKey = dueKeyFor(todo);
  await events.cancelStale(user._id, todo._id, dueKey).catch(() => {});

  let created = 0;

  if (settings.pushEnabled) {
    for (const { stage, offsetMinutes } of PUSH_STAGES) {
      const scheduledFor = due + offsetMinutes * 60_000;
      if (scheduledFor < now - PUSH_GRACE_MS) continue;
      const row = await events.create({
        userId: user._id,
        todoId: todo._id,
        dueKey,
        stage,
        channel: 'push',
        scheduledFor,
      });
      if (row) created += 1;
    }
  }

  if (settings.enabled && settings.sipUri && settings.sipVerified && settings.consentAt) {
    if (due >= now - CALL_GRACE_MS) {
      const row = await events.create({
        userId: user._id,
        todoId: todo._id,
        dueKey,
        stage: 'call',
        channel: 'call',
        scheduledFor: due,
      });
      if (row) created += 1;
    }
  }

  return created;
}

async function sendPushFor(event, user, todo) {
  const language = settingsOf(user).voiceLanguage;
  const when = formatDueForSpeech(todo, timezoneOf(user), language);
  const lead = event.stage === 'push_30' ? 'in 30 minutes' : 'in 10 minutes';

  return push.sendToUser(user._id, {
    title: event.stage === 'push_30' ? 'Task due soon' : 'Task due in 10 minutes',
    body: `${String(todo.text || 'Task').slice(0, 140)}${when ? ` · ${when}` : ''} (${lead})`,
    // push_10 shares the client-side tag, so an open tab and the server push
    // replace each other instead of stacking duplicate notifications.
    tag:
      event.stage === 'push_30'
        ? `${event.dueKey.replaceAll('|', ':')}:30`
        : event.dueKey.replaceAll('|', ':'),
    data: { todoId: event.todoId, eventId: event._id, url: '/' },
  });
}

async function queueRetry(event, user) {
  const settings = settingsOf(user);
  const current = await events.findById(event._id);
  if (!current || !['failed', 'no_answer'].includes(current.status)) return;
  if (Number(current.attempt || 0) >= settings.maxRetries) return;

  const nextAttempt = Number(current.attempt || 0) + 1;
  await events.create({
    userId: event.userId,
    todoId: event.todoId,
    dueKey: event.dueKey,
    stage: `retry_${nextAttempt}`,
    channel: 'call',
    scheduledFor: addMinutes(Date.now(), RETRY_DELAY_MINUTES),
    attempt: nextAttempt,
  });
}

async function markCallFailed(event, user, message) {
  const current = await events.findById(event._id);
  if (
    !current ||
    ['completed', 'snoozed', 'opted_out', 'skipped'].includes(current.status)
  ) {
    return;
  }
  await events.update(event._id, {
    status: 'failed',
    error: String(message || 'Call failed').slice(0, 300),
    endedAt: new Date(),
  });
  await queueRetry(event, user);
}

async function finalizeCall(event, outcome) {
  const user = await scheduler.findUserById(event.userId);
  if (!user) return;

  const current = await events.findById(event._id);
  if (!current) return;
  // A DTMF action already wrote the final status; never overwrite it.
  if (['completed', 'snoozed', 'opted_out', 'skipped'].includes(current.status)) return;

  const known = ['answered', 'no_answer', 'failed'];
  const status = known.includes(outcome.status) ? outcome.status : 'sent';
  await events.update(event._id, {
    status,
    endedAt: new Date(),
    error: outcome.status === 'failed' ? 'Call failed' : '',
  });

  if (status === 'no_answer' || status === 'failed') {
    await queueRetry(event, user);
  }
}

/** Next calendar date for a recurring task, matching the UI's roll-forward. */
function advanceDateKey(dateKey, repeat, timeZone) {
  const base = dateKey || localDateKey(Date.now(), timeZone);
  const days = repeat === 'weekly' ? 7 : 1;
  const [year, month, day] = base.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

async function handleDtmf(event, digit) {
  const user = await scheduler.findUserById(event.userId);
  if (!user) return null;

  if (digit === '1') {
    // Reuse the user-scoped repository so recurring tasks roll forward exactly
    // like they do in the UI.
    const repos = createRepos(event.userId);
    const todo = await scheduler.findTodo(event.userId, event.todoId);

    if (todo?.repeat && todo.repeat !== 'none') {
      await repos.todos.update(event.todoId, {
        dueDate: advanceDateKey(todo.dueDate, todo.repeat, timezoneOf(user)),
        completed: false,
        completedAt: null,
      });
    } else {
      await repos.todos.update(event.todoId, { completed: true });
    }

    await events.cancelForTodo(event.userId, event.todoId);
    await events.update(event._id, { status: 'completed', endedAt: new Date() });
    return 'completed';
  }

  if (digit === '2') {
    await events.create({
      userId: event.userId,
      todoId: event.todoId,
      dueKey: event.dueKey,
      stage: `snooze_${Date.now()}`,
      channel: 'call',
      scheduledFor: addMinutes(Date.now(), 15),
    });
    await events.update(event._id, { status: 'snoozed', endedAt: new Date() });
    return 'snoozed';
  }

  if (digit === '9') {
    await users.disableReminders(event.userId);
    await events.cancelForTodo(event.userId, event.todoId);
    await events.update(event._id, { status: 'opted_out', endedAt: new Date() });
    return 'opted_out';
  }

  return null;
}

async function processEvent(event, now = Date.now()) {
  const user = await scheduler.findUserById(event.userId);
  if (!user) {
    await events.update(event._id, { status: 'skipped', error: 'Account removed' });
    return;
  }

  // The row may have been cancelled by a task edit after it was claimed.
  const claimed = await events.findById(event._id);
  if (!claimed || claimed.status !== 'processing') return;

  const todo = await scheduler.findTodo(event.userId, event.todoId);
  if (!todo || todo.completed || todo.trashed) {
    await events.update(event._id, { status: 'skipped', error: 'Task is no longer open' });
    return;
  }

  const settings = settingsOf(user);

  if (event.channel === 'push') {
    if (!settings.pushEnabled) {
      await events.update(event._id, { status: 'skipped', error: 'Push disabled' });
      return;
    }
    const result = await sendPushFor(event, user, todo);
    await events.update(event._id, {
      status: result.skipped ? 'skipped' : result.sent > 0 ? 'sent' : 'failed',
      error: result.skipped
        ? 'No push subscription for this account'
        : result.sent > 0
          ? ''
          : 'Push delivery failed',
      endedAt: new Date(),
    });
    return;
  }

  // ---- Voice call ----
  if (!settings.enabled || !settings.sipUri || !settings.sipVerified || !settings.consentAt) {
    await events.update(event._id, { status: 'skipped', error: 'Voice reminders are not verified' });
    return;
  }

  const timezone = timezoneOf(user);
  if (isQuietHours(now, timezone, settings.quietStart, settings.quietEnd)) {
    await events.update(event._id, { status: 'skipped', error: 'Quiet hours' });
    return;
  }

  // The current row is already counted, so `>` allows exactly the configured
  // number of calls per local day.
  const callsToday = await events.countCallsSince(event.userId, startOfLocalDay(now, timezone));
  if (callsToday > MAX_CALLS_PER_DAY) {
    await events.update(event._id, { status: 'skipped', error: 'Daily call limit reached' });
    return;
  }

  const script = buildPrompt({ user, todo, language: settings.voiceLanguage });

  try {
    const call = await voice.placeCall({
      to: settings.sipUri,
      script,
      language: settings.voiceLanguage,
      eventId: event._id,
      kind: 'reminder',
      onDtmf: (digit) => handleDtmf(event, digit),
    });

    await events.update(event._id, {
      status: 'dialing',
      provider: call.provider,
      providerCallId: call.id,
      script,
    });

    if (call.done) {
      call.done
        .then((outcome) => finalizeCall(event, outcome))
        .catch((error) => markCallFailed(event, user, error.message).catch(() => {}));
    } else {
      await events.update(event._id, { status: 'sent', endedAt: new Date() });
    }
  } catch (error) {
    await markCallFailed(event, user, error.message);
  }
}

/** Scans opted-in accounts and creates any missing reminder rows. */
async function runTick({ now = Date.now() } = {}) {
  await events.requeueStale().catch(() => {});
  const accounts = await scheduler.listSchedulerUsers();
  let created = 0;

  for (const user of accounts) {
    const timezone = timezoneOf(user);
    const fromDate = localDateKey(now - 24 * 60 * 60 * 1000, timezone);
    const toDate = localDateKey(now + 2 * 24 * 60 * 60 * 1000, timezone);
    const todos = await scheduler.listTodosForUser(user._id, { fromDate, toDate });

    for (const todo of todos) {
      created += await enqueueForTodo({ user, todo, now });
    }
  }

  return { users: accounts.length, created };
}

/** Claims and executes due rows. Safe to run from multiple ticks. */
async function processDue({ now = Date.now(), limit = SCHEDULER_BATCH_SIZE } = {}) {
  const claimed = await events.claimDue(new Date(now), limit);
  await Promise.allSettled(claimed.map((event) => processEvent(event, now)));
  return { processed: claimed.length };
}

async function runOnce(options = {}) {
  const tick = await runTick(options);
  const due = await processDue(options);
  return { ...tick, ...due };
}

function startScheduler() {
  if (process.env.SCHEDULER_ENABLED === 'false') {
    console.log('[scheduler] disabled by SCHEDULER_ENABLED=false');
    return () => {};
  }

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runOnce();
    } catch (error) {
      console.error(`[scheduler] ${error.message}`);
    } finally {
      running = false;
    }
  };

  run();
  const interval = Number(process.env.SCHEDULER_INTERVAL_MS) || 30_000;
  const timer = setInterval(run, interval);
  if (typeof timer.unref === 'function') timer.unref();
  console.log(`[scheduler] running every ${Math.round(interval / 1000)}s`);
  return () => clearInterval(timer);
}

// ---- Settings and verification -------------------------------------------------

async function updateSettings(user, input = {}, repo = users) {
  const base = user.reminders || {};
  const next = sanitizeReminderSettings(input, base);

  // Withdrawing consent also turns calling off. Explicitly asking to enable
  // and withdraw consent in the same request is contradictory.
  if (input.consent === false) {
    if (input.enabled === true) {
      throw httpError('Consent is required before enabling voice reminders.', 400);
    }
    next.enabled = false;
  }
  if (!isValidTimeZone(next.timezone)) next.timezone = 'UTC';

  if (next.enabled && !next.consentAt) {
    throw httpError('Consent is required before enabling voice reminders.', 400);
  }
  if (next.enabled && !next.sipUri) {
    throw httpError('Add a SIP address before enabling voice reminders.', 400);
  }
  if (next.enabled && !isValidSipUri(next.sipUri)) {
    throw httpError('Enter a valid SIP address, for example name@sip.linphone.org.', 400);
  }

  const sipChanged = String(next.sipUri || '') !== String(base.sipUri || '');
  next.sipVerifiedAt = sipChanged ? null : base.sipVerifiedAt ?? null;

  const updated = await repo.updateReminders(user._id, next);
  if (!updated) throw httpError('Your account no longer exists.', 401);
  if (sipChanged) await repo.clearSipVerify(user._id);
  return toUserDTO(updated);
}

async function startVerification(user, repo = users) {
  const settings = settingsOf(user);
  if (!settings.consentAt) {
    throw httpError('Tick the consent box before requesting a verification call.', 400);
  }
  if (!isValidSipUri(settings.sipUri)) {
    throw httpError('Save a valid SIP address first.', 400);
  }

  const previous = user.sipVerify || {};
  if (previous.lastSentAt && Date.now() - previous.lastSentAt < VERIFY_COOLDOWN_MS) {
    throw httpError('Wait a minute before requesting another verification call.', 429);
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = crypto
    .createHash('sha256')
    .update(`${user._id}:${code}`)
    .digest('hex');

  const call = await voice.placeCall({
    to: settings.sipUri,
    script: verificationScript(code),
    language: 'en',
    eventId: `verify_${user._id}_${Date.now()}`,
    kind: 'verification',
  });

  await repo.setSipVerify(user._id, {
    codeHash,
    sipUri: settings.sipUri,
    expiresAt: Date.now() + VERIFY_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
  });

  return {
    sent: true,
    provider: call.provider,
    expiresAt: Date.now() + VERIFY_TTL_MS,
    // The console adapter cannot speak, so development needs the code.
    devCode: call.simulated ? code : undefined,
  };
}

async function confirmVerification(user, code, repo = users) {
  const verify = user.sipVerify || {};
  const settings = settingsOf(user);
  const entered = String(code || '').trim();

  if (!/^\d{6}$/.test(entered)) {
    throw httpError('Enter the 6-digit code from the call.', 400);
  }
  if (!verify.codeHash) throw httpError('Request a verification call first.', 400);
  if (Number(verify.expiresAt || 0) < Date.now()) {
    throw httpError('That code expired. Request a new call.', 400);
  }
  if (verify.sipUri !== settings.sipUri) {
    throw httpError('The SIP address changed. Request a new code.', 400);
  }
  if (Number(verify.attempts || 0) >= VERIFY_MAX_ATTEMPTS) {
    throw httpError('Too many attempts. Request a new code.', 429);
  }

  const hash = crypto
    .createHash('sha256')
    .update(`${user._id}:${entered}`)
    .digest('hex');

  const matches =
    hash.length === String(verify.codeHash).length &&
    crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(String(verify.codeHash)));

  if (!matches) {
    await repo.setSipVerify(user._id, {
      ...verify,
      attempts: Number(verify.attempts || 0) + 1,
    });
    throw httpError('That code is not correct.', 400);
  }

  const updated = await repo.markSipVerified(user._id);
  if (!updated) throw httpError('Your account no longer exists.', 401);
  return toUserDTO(updated);
}

async function sendTestCall(user) {
  const settings = settingsOf(user);
  if (!settings.consentAt) {
    throw httpError('Tick the consent box before placing a test call.', 400);
  }
  if (!settings.sipUri || !settings.sipVerified) {
    throw httpError('Verify a SIP address before testing.', 400);
  }

  const call = await voice.placeCall({
    to: settings.sipUri,
    script:
      'Hello. This is Nova. Your voice reminders are working. Press 1 to mark a task complete, 2 to snooze, or 9 to stop all calls.',
    language: settings.voiceLanguage,
    eventId: `test_${user._id}_${Date.now()}`,
    kind: 'test',
  });

  return { sent: true, provider: call.provider, simulated: Boolean(call.simulated) };
}

async function listEvents(userId, limit = 25) {
  const rows = await events.listByUser(userId, limit);
  return rows.map(toReminderEventDTO);
}

function status() {
  return {
    ...voice.status(),
    push: { configured: push.isConfigured() },
    limits: {
      maxCallsPerDay: MAX_CALLS_PER_DAY,
      retryDelayMinutes: RETRY_DELAY_MINUTES,
    },
  };
}

module.exports = {
  dueKeyFor,
  advanceDateKey,
  buildPrompt,
  enqueueForTodo,
  runTick,
  processDue,
  runOnce,
  startScheduler,
  updateSettings,
  startVerification,
  confirmVerification,
  sendTestCall,
  listEvents,
  status,
  handleDtmf,
};
