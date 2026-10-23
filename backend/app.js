const express = require('express');
const cors = require('cors');

const db = require('./db');
const { mapError } = require('./lib/errors');
const gemini = require('./lib/gemini');
const {
  buildPlanPrompt,
  buildEnhancePrompt,
  buildSummarizeNotePrompt,
  buildSummarizeAllPrompt,
  normalizePlan,
  normalizeContent,
  normalizeSummary,
} = require('./lib/ai');

/**
 * Storage-agnostic application factory.
 *
 * `repos` must provide:
 *   notes: { list, create, update, remove }
 *   todos: { list, create, update, remove, reorder }
 */
function createApp({ repos } = {}) {
  if (!repos?.notes || !repos?.todos) {
    throw new Error('createApp requires { repos: { notes, todos } }');
  }

  const app = express();
  app.use(cors());
  // Base64 attachments (PDFs) need more room than plain JSON payloads.
  app.use(express.json({ limit: '12mb' }));

  // Express 4 does not catch rejected promises. Wrap every async handler.
  const wrap = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

  // ---------- Notes ----------
  app.get(
    '/api/notes',
    wrap(async (req, res) => {
      res.json(await repos.notes.list());
    })
  );

  app.post(
    '/api/notes',
    wrap(async (req, res) => {
      res.status(201).json(await repos.notes.create(req.body ?? {}));
    })
  );

  app.put(
    '/api/notes/:id',
    wrap(async (req, res) => {
      const note = await repos.notes.update(req.params.id, req.body ?? {});
      if (!note) return res.status(404).json({ error: 'Note not found' });
      return res.json(note);
    })
  );

  app.delete(
    '/api/notes/:id',
    wrap(async (req, res) => {
      const removed = await repos.notes.remove(req.params.id);
      if (!removed) return res.status(404).json({ error: 'Note not found' });
      return res.json({ success: true });
    })
  );

  // ---------- Todos ----------
  app.get(
    '/api/todos',
    wrap(async (req, res) => {
      res.json(await repos.todos.list());
    })
  );

  // Registered before /api/todos/:id so "reorder" is not read as an id.
  app.put(
    '/api/todos/reorder',
    wrap(async (req, res) => {
      const incoming = req.body?.todos;
      if (!Array.isArray(incoming)) {
        return res.status(400).json({ error: 'A "todos" array is required' });
      }
      return res.json(await repos.todos.reorder(incoming));
    })
  );

  app.post(
    '/api/todos',
    wrap(async (req, res) => {
      const result = await repos.todos.create(req.body ?? {});
      if (!result.ok) return res.status(400).json({ error: 'Todo text is required' });
      return res.status(201).json(result.todo);
    })
  );

  app.put(
    '/api/todos/:id',
    wrap(async (req, res) => {
      const result = await repos.todos.update(req.params.id, req.body ?? {});
      if (!result.ok && result.reason === 'not_found') {
        return res.status(404).json({ error: 'Todo not found' });
      }
      if (!result.ok) return res.status(400).json({ error: 'Todo text is required' });
      return res.json(result.todo);
    })
  );

  app.delete(
    '/api/todos/:id',
    wrap(async (req, res) => {
      const removed = await repos.todos.remove(req.params.id);
      if (!removed) return res.status(404).json({ error: 'Todo not found' });
      return res.json({ success: true });
    })
  );

  // ---------- AI (Gemini) ----------
  app.get(
    '/api/ai/status',
    wrap(async (req, res) => {
      res.json({ configured: gemini.isConfigured(), model: gemini.getModel() });
    })
  );

  /**
   * Turns a topic or an uploaded file into notes + tasks and saves both.
   * The browser never sees the API key; Gemini is called server-side.
   */
  app.post(
    '/api/ai/plan',
    wrap(async (req, res) => {
      const { topic = '', file = null } = req.body ?? {};
      const hasTopic = String(topic).trim().length > 0;
      const hasFile = Boolean(file?.data && file?.mimeType);

      if (!hasTopic && !hasFile) {
        return res.status(400).json({ error: 'Provide a topic or attach a file.' });
      }

      const files = hasFile ? [{ mimeType: file.mimeType, data: file.data }] : [];
      const raw = await gemini.generateJson({
        prompt: buildPlanPrompt({ topic, fileName: hasFile ? file.name : null }),
        files,
      });

      const plan = normalizePlan(raw);
      if (plan.notes.length === 0 && plan.tasks.length === 0) {
        return res.status(422).json({
          error: 'Gemini did not return a usable plan. Try rephrasing the topic.',
        });
      }

      // Repositories prepend new records; create in reverse so the model's
      // order survives on the board ("first task" appears first).
      const notes = [];
      for (const note of [...plan.notes].reverse()) {
        notes.push(await repos.notes.create(note));
      }

      const tasks = [];
      for (const task of [...plan.tasks].reverse()) {
        const result = await repos.todos.create(task);
        if (result.ok) tasks.push(result.todo);
      }

      return res.status(201).json({
        plan: { title: plan.title, summary: plan.summary },
        notes,
        tasks,
      });
    })
  );

  app.post(
    '/api/ai/notes/enhance',
    wrap(async (req, res) => {
      const { title = '', content = '' } = req.body ?? {};
      if (!String(content).trim()) {
        return res.status(400).json({ error: 'A note with content is required.' });
      }

      const raw = await gemini.generateJson({
        prompt: buildEnhancePrompt({ title, content }),
      });
      const improved = normalizeContent(raw);
      if (!improved) {
        return res.status(422).json({ error: 'Gemini returned an empty note. Try again.' });
      }
      return res.json({ content: improved });
    })
  );

  app.post(
    '/api/ai/notes/summarize',
    wrap(async (req, res) => {
      const { notes, title = '', content = '' } = req.body ?? {};
      const collection = Array.isArray(notes) ? notes : [];

      if (collection.length === 0 && !String(content).trim()) {
        return res.status(400).json({ error: 'A note or a list of notes is required.' });
      }

      const raw = await gemini.generateJson({
        prompt:
          collection.length > 0
            ? buildSummarizeAllPrompt({ notes: collection })
            : buildSummarizeNotePrompt({ title, content }),
      });
      const summary = normalizeSummary(raw);
      if (!summary) {
        return res.status(422).json({ error: 'Gemini returned an empty summary. Try again.' });
      }
      return res.json({ summary });
    })
  );

  app.get(
    '/api/health',
    wrap(async (req, res) => {
      try {
        await db.ping();
      } catch (error) {
        console.error('Health check failed:', error.message);
        return res.status(503).json({
          status: 'degraded',
          storage: 'mongodb',
          error: 'Database unavailable',
          timestamp: new Date().toISOString(),
        });
      }
      return res.json({
        status: 'ok',
        storage: 'mongodb',
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    const { status, body } = mapError(error);
    if (status >= 500 && error.status) {
      // Expected service failures (e.g. Gemini) get a concise line, not a stack.
      console.error(`API error ${status}: ${error.message}`);
    } else if (status >= 500) {
      console.error(error);
    }
    res.status(status).json(body);
  });

  return app;
}

module.exports = { createApp };
