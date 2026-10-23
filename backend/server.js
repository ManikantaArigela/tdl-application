const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const PRIORITIES = new Set(['low', 'medium', 'high']);
const LIMITS = {
  title: 300,
  content: 100_000,
  todo: 1_000,
  tags: 12,
};

const clampString = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

const normalizeTags = (value) => {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((tag) => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  ].slice(0, LIMITS.tags);
};

const normalizePriority = (value, fallback = 'medium') =>
  PRIORITIES.has(value) ? value : fallback;

const normalizeDueDate = (value, fallback = null) => {
  if (value === undefined) return fallback;
  if (value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  return fallback;
};

const normalizeTimestamp = (value, fallback = null) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function sanitizeNote(input, base = {}) {
  return {
    title: input.title !== undefined ? clampString(input.title, LIMITS.title) : base.title ?? '',
    content:
      input.content !== undefined ? clampString(input.content, LIMITS.content) : base.content ?? '',
    tags: input.tags !== undefined ? normalizeTags(input.tags) : base.tags ?? [],
    pinned: input.pinned !== undefined ? Boolean(input.pinned) : base.pinned ?? false,
    archived: input.archived !== undefined ? Boolean(input.archived) : base.archived ?? false,
  };
}

function sanitizeTodo(input, base = {}) {
  const completed =
    input.completed !== undefined ? Boolean(input.completed) : base.completed ?? false;
  return {
    text: (input.text !== undefined ? clampString(input.text, LIMITS.todo) : base.text ?? '').trim(),
    priority:
      input.priority !== undefined ? normalizePriority(input.priority, base.priority) : base.priority ?? 'medium',
    completed,
    dueDate: normalizeDueDate(input.dueDate, base.dueDate ?? null),
    completedAt: completed
      ? normalizeTimestamp(input.completedAt, base.completedAt ?? Date.now())
      : null,
  };
}

function createApp(options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(__dirname, 'data');
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  const filePath = (file) => path.join(dataDir, file);

  async function readJson(file, fallback = []) {
    let raw;
    try {
      raw = await fs.readFile(filePath(file), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        await writeJson(file, fallback);
        return fallback;
      }
      throw error;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Data file "${file}" contains invalid JSON`);
    }
    return Array.isArray(parsed) ? parsed : [];
  }

  async function writeJson(file, data) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(filePath(file), JSON.stringify(data, null, 2));
  }

  // Express 4 does not catch rejected promises. Wrap every async handler.
  const wrap = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

  // ---------- Notes ----------
  app.get(
    '/api/notes',
    wrap(async (req, res) => {
      res.json(await readJson('notes.json'));
    })
  );

  app.post(
    '/api/notes',
    wrap(async (req, res) => {
      const notes = await readJson('notes.json');
      const now = Date.now();
      const note = {
        id: `n_${crypto.randomUUID()}`,
        ...sanitizeNote(req.body ?? {}),
        createdAt: now,
        updatedAt: now,
      };
      notes.unshift(note);
      await writeJson('notes.json', notes);
      res.status(201).json(note);
    })
  );

  app.put(
    '/api/notes/:id',
    wrap(async (req, res) => {
      const notes = await readJson('notes.json');
      const index = notes.findIndex((note) => note.id === req.params.id);
      if (index === -1) return res.status(404).json({ error: 'Note not found' });

      const updated = {
        ...notes[index],
        ...sanitizeNote(req.body ?? {}, notes[index]),
        id: notes[index].id,
        createdAt: notes[index].createdAt,
        updatedAt: Date.now(),
      };
      notes[index] = updated;
      await writeJson('notes.json', notes);
      return res.json(updated);
    })
  );

  app.delete(
    '/api/notes/:id',
    wrap(async (req, res) => {
      const notes = await readJson('notes.json');
      const filtered = notes.filter((note) => note.id !== req.params.id);
      if (filtered.length === notes.length) {
        return res.status(404).json({ error: 'Note not found' });
      }
      await writeJson('notes.json', filtered);
      return res.json({ success: true });
    })
  );

  // ---------- Todos ----------
  app.get(
    '/api/todos',
    wrap(async (req, res) => {
      res.json(await readJson('todos.json'));
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

      const existing = await readJson('todos.json');
      const byId = new Map(existing.map((todo) => [todo.id, todo]));
      const seen = new Set();
      const reordered = [];

      for (const item of incoming) {
        const id = typeof item === 'string' ? item : item?.id;
        if (!id || seen.has(id) || !byId.has(id)) continue;
        seen.add(id);
        reordered.push(byId.get(id));
      }

      // Never drop records that the client did not send.
      for (const todo of existing) {
        if (!seen.has(todo.id)) reordered.push(todo);
      }

      await writeJson('todos.json', reordered);
      return res.json(reordered);
    })
  );

  app.post(
    '/api/todos',
    wrap(async (req, res) => {
      const todo = {
        id: `t_${crypto.randomUUID()}`,
        ...sanitizeTodo(req.body ?? {}),
        createdAt: Date.now(),
      };

      if (!todo.text) {
        return res.status(400).json({ error: 'Todo text is required' });
      }

      if (todo.completedAt === undefined) todo.completedAt = todo.completed ? Date.now() : null;

      const todos = await readJson('todos.json');
      todos.unshift(todo);
      await writeJson('todos.json', todos);
      return res.status(201).json(todo);
    })
  );

  app.put(
    '/api/todos/:id',
    wrap(async (req, res) => {
      const todos = await readJson('todos.json');
      const index = todos.findIndex((todo) => todo.id === req.params.id);
      if (index === -1) return res.status(404).json({ error: 'Todo not found' });

      const updated = {
        ...todos[index],
        ...sanitizeTodo(req.body ?? {}, todos[index]),
        id: todos[index].id,
        createdAt: todos[index].createdAt,
      };
      if (!updated.text) {
        return res.status(400).json({ error: 'Todo text is required' });
      }

      todos[index] = updated;
      await writeJson('todos.json', todos);
      return res.json(updated);
    })
  );

  app.delete(
    '/api/todos/:id',
    wrap(async (req, res) => {
      const todos = await readJson('todos.json');
      const filtered = todos.filter((todo) => todo.id !== req.params.id);
      if (filtered.length === todos.length) {
        return res.status(404).json({ error: 'Todo not found' });
      }
      await writeJson('todos.json', filtered);
      return res.json({ success: true });
    })
  );

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', storage: 'json', timestamp: new Date().toISOString() });
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body is not valid JSON' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 5001;
  const app = createApp();
  app.listen(port, () => {
    console.log(`Nova Notes backend running on http://localhost:${port}`);
  });
}

module.exports = { createApp };
