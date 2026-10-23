/**
 * AI layer tests: normalization is pure, and the routes must fail cleanly when
 * no Gemini key is configured. These tests never call Google.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Guarantee the "not configured" path even if the developer exports a key.
delete process.env.GEMINI_API_KEY;

const { createApp } = require('../app');
const { normalizePlan, normalizeContent, normalizeSummary } = require('../lib/ai');

let server;
let baseUrl;

before(async () => {
  const repos = {
    notes: { create: async (note) => note },
    todos: { create: async (todo) => ({ ok: true, todo }) },
  };
  const app = createApp({ repos });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (response) => ({ response, body: await response.json().catch(() => null) }));
}

test('AI status reports an unconfigured server without exposing a key', async () => {
  const response = await fetch(`${baseUrl}/api/ai/status`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.configured, false);
  assert.equal(typeof body.model, 'string');
  assert.equal(body.apiKey, undefined);
});

test('AI routes validate input before calling Gemini', async () => {
  const plan = await post('/api/ai/plan', {});
  assert.equal(plan.response.status, 400);

  const enhance = await post('/api/ai/notes/enhance', { content: '   ' });
  assert.equal(enhance.response.status, 400);

  const summary = await post('/api/ai/notes/summarize', {});
  assert.equal(summary.response.status, 400);
});

test('AI routes return a usable 503 message when GEMINI_API_KEY is missing', async () => {
  const plan = await post('/api/ai/plan', { topic: 'cell division' });
  assert.equal(plan.response.status, 503);
  assert.match(plan.body.error, /not configured/i);
  assert.match(plan.body.error, /GEMINI_API_KEY/);

  const summary = await post('/api/ai/notes/summarize', {
    notes: [{ title: 'Cells', content: 'Mitosis has four phases.' }],
  });
  assert.equal(summary.response.status, 503);
});

test('normalizePlan clamps model output into safe task and note fields', () => {
  const plan = normalizePlan({
    title: '  Exam prep  ',
    summary: 'Plan',
    notes: [{ title: 'Cells', content: '## Notes', tags: ['bio', 7, ' '] }],
    tasks: [
      {
        text: 'Review chapter 3',
        priority: 'urgent',
        dueDate: '2026-10-24',
        dueTime: '9:05',
        repeat: 'sometimes',
      },
      { text: '   ', priority: 'low' },
      { text: 'Weekly quiz', dueDate: 'nope', dueTime: '25:00', repeat: 'weekly' },
    ],
  });

  assert.equal(plan.title, 'Exam prep');
  assert.equal(plan.notes.length, 1);
  assert.deepEqual(plan.notes[0].tags, ['bio', 'ai-plan']);

  assert.equal(plan.tasks.length, 2);
  assert.equal(plan.tasks[0].text, 'Review chapter 3');
  assert.equal(plan.tasks[0].priority, 'high');
  assert.equal(plan.tasks[0].dueTime, '09:05');
  assert.equal(plan.tasks[0].repeat, 'none');
  assert.equal(new Date(plan.tasks[0].dueDate).getHours(), 12);

  assert.equal(plan.tasks[1].dueDate, null);
  assert.equal(plan.tasks[1].dueTime, null);
  assert.equal(plan.tasks[1].repeat, 'weekly');
});

test('normalizeContent and normalizeSummary accept alternate keys', () => {
  assert.equal(normalizeContent({ markdown: ' improved ' }), 'improved');
  assert.equal(normalizeSummary({ content: ' brief ' }), 'brief');
  assert.equal(normalizeContent({}), '');
  assert.equal(normalizeSummary({}), '');
});
