/**
 * Pure guards for the reminder engine: timezone math, quiet hours, SIP
 * validation, and the multilingual prompt builder. The network paths (ARI,
 * push) are exercised by the deploy smoke test, not here.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  dueInstant,
  isQuietHours,
  localDateKey,
  startOfLocalDay,
} = require('../lib/time');
const { sanitizeReminderSettings, isValidSipUri } = require('../lib/sanitize');
const { buildPrompt, dueKeyFor, advanceDateKey } = require('../services/reminders');

test('dueInstant interprets a date-only task in the account timezone', () => {
  const due = dueInstant({
    dueDate: '2026-11-03',
    dueTime: '09:00',
    timeZone: 'Asia/Kolkata',
  });
  assert.equal(due, Date.UTC(2026, 10, 3, 3, 30));

  // No time defaults to 09:00 local, matching the browser helper.
  const defaulted = dueInstant({ dueDate: '2026-11-03', timeZone: 'Asia/Kolkata' });
  assert.equal(defaulted, due);
});

test('dueInstant follows daylight-saving offsets', () => {
  const winter = dueInstant({
    dueDate: '2026-01-15',
    dueTime: '09:00',
    timeZone: 'America/New_York',
  });
  const summer = dueInstant({
    dueDate: '2026-07-15',
    dueTime: '09:00',
    timeZone: 'America/New_York',
  });

  assert.equal(winter, Date.UTC(2026, 0, 15, 14, 0));
  assert.equal(summer, Date.UTC(2026, 6, 15, 13, 0));
});

test('dueInstant accepts a full local datetime and an explicit instant', () => {
  assert.equal(
    dueInstant({ dueDate: '2026-11-03T18:45', timeZone: 'Asia/Kolkata' }),
    Date.UTC(2026, 10, 3, 13, 15)
  );
  assert.equal(
    dueInstant({ dueDate: '2026-11-03T12:00:00.000Z', timeZone: 'Asia/Kolkata' }),
    Date.UTC(2026, 10, 3, 12, 0)
  );
  assert.equal(dueInstant({ dueDate: '', timeZone: 'UTC' }), null);
});

test('dueInstant applies dueTime to a zoned dueDate', () => {
  // 2026-11-04T06:30Z is 12:00 IST; the user's 22:00 IST must win.
  assert.equal(
    dueInstant({
      dueDate: '2026-11-04T06:30:00.000Z',
      dueTime: '22:00',
      timeZone: 'Asia/Kolkata',
    }),
    Date.UTC(2026, 10, 4, 16, 30)
  );
});

test('quiet hours wrap midnight and use the account timezone', () => {
  const at = (iso) => Date.parse(iso);

  // 22:00 IST is inside 21:00 → 08:00.
  assert.equal(isQuietHours(at('2026-11-03T16:30:00Z'), 'Asia/Kolkata', '21:00', '08:00'), true);
  // 12:00 IST is outside.
  assert.equal(isQuietHours(at('2026-11-03T06:30:00Z'), 'Asia/Kolkata', '21:00', '08:00'), false);
  // Equal bounds mean "never quiet".
  assert.equal(isQuietHours(at('2026-11-03T16:30:00Z'), 'Asia/Kolkata', '21:00', '21:00'), false);
});

test('local day boundaries are midnight in the account timezone', () => {
  const now = Date.parse('2026-11-03T20:00:00Z');
  assert.equal(localDateKey(now, 'Asia/Kolkata'), '2026-11-04');
  assert.equal(startOfLocalDay(now, 'Asia/Kolkata'), Date.UTC(2026, 10, 3, 18, 30));
});

test('reminder settings validate the SIP address and preserve consent', () => {
  assert.equal(isValidSipUri('alice@sip.linphone.org'), true);
  assert.equal(isValidSipUri('alice@localhost'), false);
  assert.equal(isValidSipUri('not an address'), false);

  const settings = sanitizeReminderSettings(
    {
      enabled: true,
      sipUri: 'Alice@SIP.Linphone.org',
      voiceLanguage: 'te',
      timezone: 'Asia/Kolkata',
      quietStart: '22:30',
      quietEnd: '07:15',
      maxRetries: 9,
      consent: true,
    },
    {}
  );

  assert.equal(settings.enabled, true);
  assert.equal(settings.pushEnabled, true);
  assert.equal(settings.sipUri, 'alice@sip.linphone.org');
  assert.equal(settings.voiceLanguage, 'te');
  assert.equal(settings.timezone, 'Asia/Kolkata');
  assert.equal(settings.quietStart, '22:30');
  assert.equal(settings.quietEnd, '07:15');
  assert.equal(settings.maxRetries, 3);
  assert.ok(settings.consentAt > 0);

  const invalid = sanitizeReminderSettings({ sipUri: 'nope' }, {});
  assert.equal(invalid.sipUri, '');
});

test('reminder settings keep verification when the SIP address is unchanged', () => {
  const base = {
    sipUri: 'alice@sip.linphone.org',
    sipVerifiedAt: 1_700_000_000_000,
    consentAt: 1_699_000_000_000,
  };
  const next = sanitizeReminderSettings({ voiceLanguage: 'hi' }, base);
  assert.equal(next.voiceLanguage, 'hi');
  assert.equal(next.consentAt, base.consentAt);
});

test('prompts are built in each supported voice language', () => {
  const user = { name: 'Ada Lovelace', reminders: { timezone: 'UTC' } };
  const todo = { text: 'Send the report', dueDate: '2026-11-03', dueTime: '09:00' };

  const english = buildPrompt({ user, todo, language: 'en' });
  assert.match(english, /Hello Ada/);
  assert.match(english, /Send the report/);
  assert.match(english, /Press 1/);

  const hindi = buildPrompt({ user, todo, language: 'hi' });
  assert.match(hindi, /नमस्ते Ada/);
  assert.match(hindi, /1 दबाएँ/);

  const telugu = buildPrompt({ user, todo, language: 'te' });
  assert.match(telugu, /నమస్కారం Ada/);
  assert.match(telugu, /1 నొక్కండి/);

  const bilingual = buildPrompt({ user, todo, language: 'en-hi' });
  assert.match(bilingual, /Hello Ada/);
  assert.match(bilingual, /नमस्ते Ada/);
});

test('recurring tasks roll forward by calendar day', () => {
  assert.equal(advanceDateKey('2026-11-03', 'daily', 'UTC'), '2026-11-04');
  assert.equal(advanceDateKey('2026-12-31', 'daily', 'UTC'), '2027-01-01');
  assert.equal(advanceDateKey('2026-11-03', 'weekly', 'UTC'), '2026-11-10');
});

test('dueKey is stable for the same task, date, and time', () => {
  const todo = { _id: 't_1', dueDate: '2026-11-03', dueTime: '09:00' };
  assert.equal(dueKeyFor(todo), 't_1|2026-11-03|09:00');
  assert.equal(dueKeyFor({ ...todo, text: 'changed' }), dueKeyFor(todo));
  assert.notEqual(dueKeyFor({ ...todo, dueTime: '10:00' }), dueKeyFor(todo));
});
