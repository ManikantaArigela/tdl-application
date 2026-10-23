const express = require('express');
const cors = require('cors');

const db = require('./db');
const { mapError } = require('./lib/errors');

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
  app.use(express.json({ limit: '1mb' }));

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
    if (status >= 500) console.error(error);
    res.status(status).json(body);
  });

  return app;
}

module.exports = { createApp };
