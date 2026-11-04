const crypto = require('crypto');

const push = require('../../services/push');

/**
 * Free in-app call adapter.
 *
 * There is no PSTN leg here. The server sends a high-priority Web Push, the
 * user taps Answer in Nova Notes, and the app speaks the stored prompt with the
 * device's built-in text-to-speech. That makes reminder calls cost $0 while
 * still keeping the same answer / no-answer / retry lifecycle as SIP.
 *
 * `VOICE_PROVIDER=inapp` is intentionally separate from `ari`: an Asterisk
 * deployment can keep using real SIP calls, while a browser-only deployment
 * still gets voice reminders without a phone number.
 */

const RING_SECONDS = Math.max(15, Number(process.env.INAPP_RING_SECONDS) || 120);

const sessions = new Map(); // eventId -> call context

function finish(session, status) {
  if (!session || session.settled) return;
  session.settled = true;
  if (session.timer) clearTimeout(session.timer);
  sessions.delete(session.eventId);
  session.resolve({
    status,
    answered: Boolean(session.answeredAt),
    durationSec: session.answeredAt
      ? Math.round((Date.now() - session.answeredAt) / 1000)
      : 0,
    action: session.action || null,
  });
}

function buildPushPayload({ eventId, todoId, todoText, script, language, kind }) {
  const isTest = kind === 'test';
  return {
    title: isTest ? 'Nova test call' : 'Incoming Nova call',
    body: String(todoText || script || 'A task needs your attention.').slice(0, 140),
    tag: `nova-call-${todoId || eventId}`,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      { action: 'answer', title: 'Answer' },
      { action: 'snooze', title: 'Snooze 15m' },
    ],
    data: {
      kind: 'voice-call',
      eventId,
      todoId: todoId || null,
      url: `/?call=${encodeURIComponent(eventId)}`,
      script: String(script || '').slice(0, 600),
      language,
      mode: 'inapp',
    },
  };
}

async function placeCall({
  userId,
  to,
  script,
  language = 'en',
  eventId,
  kind = 'reminder',
  todoId = null,
  todoText = '',
}) {
  if (!userId) throw new Error('An in-app call needs a user id.');

  const id = eventId || `inapp_${crypto.randomUUID()}`;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const session = {
    eventId: id,
    userId,
    todoId,
    todoText,
    script,
    language,
    kind,
    resolve: resolveDone,
    settled: false,
    answeredAt: null,
    action: null,
    timer: null,
  };
  sessions.set(id, session);

  let delivered = false;
  try {
    const result = await push.sendToUser(
      userId,
      buildPushPayload({ eventId: id, todoId, todoText, script, language, kind })
    );
    delivered = Number(result?.sent || 0) > 0;
  } catch (error) {
    finish(session, 'failed');
    return { id, provider: 'inapp', simulated: false, delivered: false, done, error: error.message };
  }

  if (!delivered) {
    // No browser is subscribed. Resolve immediately so the reminder engine can
    // retry (or skip) instead of leaving the queue row stuck in `dialing`.
    finish(session, 'failed');
    return { id, provider: 'inapp', simulated: false, delivered: false, done };
  }

  session.timer = setTimeout(() => finish(session, 'no_answer'), RING_SECONDS * 1000);
  if (typeof session.timer.unref === 'function') session.timer.unref();

  return { id, provider: 'inapp', simulated: false, delivered: true, done };
}

function getSession(eventId) {
  const session = sessions.get(String(eventId || ''));
  if (!session || session.settled) return null;
  return {
    eventId: session.eventId,
    userId: session.userId,
    todoId: session.todoId,
    todoText: session.todoText,
    script: session.script,
    language: session.language,
    kind: session.kind,
  };
}

function answer(eventId) {
  const session = sessions.get(String(eventId || ''));
  if (!session || session.settled) return null;
  session.answeredAt = Date.now();
  const payload = {
    eventId: session.eventId,
    userId: session.userId,
    todoId: session.todoId,
    todoText: session.todoText,
    script: session.script,
    language: session.language,
    kind: session.kind,
  };
  // Answering ends the ringing phase. The task actions (complete/snooze/opt
  // out) still go through the reminder event row, so the session can be freed.
  finish(session, 'answered');
  return payload;
}

function decline(eventId) {
  const session = sessions.get(String(eventId || ''));
  if (!session || session.settled) return false;
  finish(session, 'no_answer');
  return true;
}

function action(eventId, actionName) {
  const session = sessions.get(String(eventId || ''));
  if (!session) return false;
  session.action = actionName;
  return true;
}

function status() {
  return {
    provider: 'inapp',
    configured: true,
    connected: false,
    simulated: false,
    ringSeconds: RING_SECONDS,
  };
}

module.exports = {
  placeCall,
  getSession,
  answer,
  decline,
  action,
  status,
  buildPushPayload,
};
