/**
 * The in-app adapter is the $0 call path: a Web Push notification plus the
 * device's text-to-speech. These tests stub the push transport so the
 * answer/decline lifecycle is deterministic and offline.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.VOICE_PROVIDER = 'inapp';

const push = require('../services/push');
push.sendToUser = async () => ({ sent: 1, failed: 0, skipped: false });

const inapp = require('../lib/voice/inapp');
const voice = require('../lib/voice');
const reminders = require('../services/reminders');

test('in-app calls do not require SIP verification', () => {
  assert.equal(voice.requiresSip(), false);
  assert.equal(voice.isInApp(), true);
  assert.equal(voice.status().provider, 'inapp');
});

test('the push payload is a high-priority call with answer/snooze actions', () => {
  const payload = inapp.buildPushPayload({
    eventId: 're_123',
    todoId: 't_1',
    todoText: 'Ship the report',
    script: 'Hello from Nova',
    language: 'hi',
    kind: 'reminder',
  });

  assert.equal(payload.requireInteraction, true);
  assert.equal(payload.data.kind, 'voice-call');
  assert.equal(payload.data.eventId, 're_123');
  assert.equal(payload.data.url, '/?call=re_123');
  assert.deepEqual(
    payload.actions.map((action) => action.action),
    ['answer', 'snooze']
  );
});

test('answering resolves the call as answered', async () => {
  const call = await inapp.placeCall({
    userId: 'u_1',
    eventId: 're_answer',
    script: 'Your task is due',
    language: 'en',
    todoText: 'Task',
  });
  assert.equal(call.delivered, true);

  const answered = inapp.answer('re_answer');
  assert.equal(answered.script, 'Your task is due');
  assert.equal(answered.language, 'en');

  const outcome = await call.done;
  assert.equal(outcome.status, 'answered');
  assert.equal(outcome.answered, true);
});

test('declining resolves the call as no_answer', async () => {
  const call = await inapp.placeCall({
    userId: 'u_1',
    eventId: 're_decline',
    script: 'Your task is due',
    language: 'te',
  });
  assert.equal(inapp.decline('re_decline'), true);

  const outcome = await call.done;
  assert.equal(outcome.status, 'no_answer');
  assert.equal(outcome.answered, false);
});

test('in-app calls can be enabled without a SIP address', async () => {
  const user = {
    _id: 'u_settings',
    email: 'inapp@example.com',
    reminders: { timezone: 'UTC' },
  };
  const repo = {
    async updateReminders(id, patch) {
      return { ...user, reminders: { ...user.reminders, ...patch } };
    },
    async clearSipVerify() {},
  };

  const updated = await reminders.updateSettings(
    user,
    {
      enabled: true,
      consent: true,
      pushEnabled: true,
      voiceLanguage: 'en',
      timezone: 'UTC',
    },
    repo
  );

  assert.equal(updated.reminders.enabled, true);
  assert.equal(updated.reminders.sipUri, '');
});
