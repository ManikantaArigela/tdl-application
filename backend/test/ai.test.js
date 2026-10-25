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
const gemini = require('../lib/gemini');

let server;
let baseUrl;

before(async () => {
  const repos = {
    notes: { create: async (note) => note },
    todos: { create: async (todo) => ({ ok: true, todo }) },
  };
  const app = createApp({
    createRepos: () => repos,
    authenticate: (req, res, next) => {
      req.userId = 'test-user';
      req.user = { id: 'test-user' };
      next();
    },
    checkDatabase: async () => true,
  });
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

function geminiResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

test('Gemini retries an overloaded primary model then uses the fallback', async () => {
  const originalFetch = global.fetch;
  const original = {
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    fallback: process.env.GEMINI_FALLBACK_MODEL,
    delay: process.env.GEMINI_RETRY_BASE_MS,
  };
  const calls = [];

  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'primary-model';
  process.env.GEMINI_FALLBACK_MODEL = 'fallback-model';
  process.env.GEMINI_RETRY_BASE_MS = '0';

  global.fetch = async (url) => {
    const model = String(url).match(/models\/([^:]+):/)?.[1] || 'unknown';
    calls.push(model);
    if (model === 'primary-model') {
      return geminiResponse(503, {
        error: {
          message:
            'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
        },
      });
    }
    return geminiResponse(200, {
      candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
    });
  };

  try {
    const value = await gemini.generateJson({ prompt: 'test' });
    assert.deepEqual(value, { ok: true });
    assert.deepEqual(calls, ['primary-model', 'primary-model', 'fallback-model']);
  } finally {
    global.fetch = originalFetch;
    for (const [name, value] of [
      ['GEMINI_API_KEY', original.key],
      ['GEMINI_MODEL', original.model],
      ['GEMINI_FALLBACK_MODEL', original.fallback],
      ['GEMINI_RETRY_BASE_MS', original.delay],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('Gemini returns a friendly retryable error after every model is overloaded', async () => {
  const originalFetch = global.fetch;
  const original = {
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    fallback: process.env.GEMINI_FALLBACK_MODEL,
    delay: process.env.GEMINI_RETRY_BASE_MS,
  };

  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'primary-model';
  process.env.GEMINI_FALLBACK_MODEL = 'fallback-model';
  process.env.GEMINI_RETRY_BASE_MS = '0';

  global.fetch = async () =>
    geminiResponse(503, {
      error: {
        message:
          'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
      },
    });

  try {
    await assert.rejects(gemini.generateJson({ prompt: 'test' }), (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.retryable, true);
      assert.match(error.message, /busy/i);
      assert.match(error.providerMessage, /high demand/i);
      return true;
    });
  } finally {
    global.fetch = originalFetch;
    for (const [name, value] of [
      ['GEMINI_API_KEY', original.key],
      ['GEMINI_MODEL', original.model],
      ['GEMINI_FALLBACK_MODEL', original.fallback],
      ['GEMINI_RETRY_BASE_MS', original.delay],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('AI routes expose retryable service failures', async () => {
  const original = gemini.generateJson;
  gemini.generateJson = async () => {
    const error = new Error('The AI model is busy right now. Please try again in a moment.');
    error.status = 503;
    error.retryable = true;
    error.providerMessage = 'high demand';
    throw error;
  };

  try {
    const plan = await post('/api/ai/plan', { topic: 'cell division' });
    assert.equal(plan.response.status, 503);
    assert.equal(plan.body.retryable, true);
    assert.match(plan.body.error, /busy/i);
  } finally {
    gemini.generateJson = original;
  }
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
