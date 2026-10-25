const express = require('express');
const cors = require('cors');

const {
  requireAuth,
  normalizeEmail,
  emailLooksValid,
  passwordLooksValid,
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
  signAccessToken,
  MIN_PASSWORD_LENGTH,
} = require('./lib/auth');
const { ping: pingDatabase } = require('./db');
const { mapError } = require('./lib/errors');
const { toUserDTO } = require('./lib/dto');
const { createRateLimiter } = require('./lib/rate-limit');
const { users: defaultUsers } = require('./repositories/users.repo');
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
 * `createRepos(userId)` returns:
 *   notes: { list, create, update, remove }
 *   todos: { list, create, update, remove, reorder }
 *
 * `authenticate` verifies the bearer token and populates `req.userId`.
 * `users` is the account store used by /api/auth. All hooks are injectable so
 * route tests run without a live MongoDB.
 */
function createApp({
  createRepos,
  authenticate = requireAuth,
  checkDatabase = pingDatabase,
  users = defaultUsers,
} = {}) {
  if (typeof createRepos !== 'function') {
    throw new Error('createApp requires { createRepos: (userId) => repos }');
  }
  if (typeof authenticate !== 'function') {
    throw new Error('createApp requires an authenticate middleware');
  }
  if (!users || typeof users.findByEmail !== 'function' || typeof users.create !== 'function') {
    throw new Error('createApp requires a users store');
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  // Base64 attachments (PDFs) need more room than plain JSON payloads.
  app.use(express.json({ limit: '12mb' }));

  // Express 4 does not catch rejected promises. Wrap every async handler.
  const wrap = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

  // Private routes need both a verified user and user-scoped repositories.
  const withRepos = (req, res, next) => {
    try {
      req.repos = createRepos(req.userId);
      return next();
    } catch (error) {
      return next(error);
    }
  };

  // Brute-force damping for credential endpoints. Per-process only.
  const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  });
  const limitAuth = (req, res, next) => {
    const key = `${req.ip}:${normalizeEmail(req.body?.email)}`;
    const retryAfter = authLimiter(key);
    if (retryAfter) {
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' });
    }
    return next();
  };

  // ---------- Public ----------
  app.get(
    '/api/health',
    wrap(async (req, res) => {
      try {
        await checkDatabase();
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

  app.get(
    '/api/ai/status',
    wrap(async (req, res) => {
      res.json({
        configured: gemini.isConfigured(),
        model: gemini.getModel(),
        fallbackModel: gemini.getFallbackModel(),
      });
    })
  );

  // ---------- Authentication ----------
  app.post(
    '/api/auth/signup',
    limitAuth,
    wrap(async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      const password = req.body?.password;

      if (!emailLooksValid(email)) {
        return res.status(400).json({ error: 'Enter a valid email address.' });
      }
      if (!passwordLooksValid(password)) {
        return res
          .status(400)
          .json({ error: `Use a password with at least ${MIN_PASSWORD_LENGTH} characters.` });
      }

      const existing = await users.findByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'An account with that email already exists.' });
      }

      const passwordHash = await hashPassword(password);
      const user = await users.create({ email, passwordHash });

      return res.status(201).json({
        token: signAccessToken(user),
        user: toUserDTO(user),
      });
    })
  );

  app.post(
    '/api/auth/login',
    limitAuth,
    wrap(async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      const password = req.body?.password;

      if (!emailLooksValid(email) || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Enter your email and password.' });
      }

      const user = await users.findByEmail(email, { withPassword: true });

      // Always run a bcrypt comparison so response timing does not reveal
      // whether the account exists.
      if (!user) {
        await verifyDummyPassword(password);
        return res.status(401).json({ error: 'Incorrect email or password.' });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Incorrect email or password.' });
      }

      return res.json({
        token: signAccessToken(user),
        user: toUserDTO(user),
      });
    })
  );

  app.get(
    '/api/auth/me',
    authenticate,
    wrap(async (req, res) => {
      const user = await users.findById(req.userId);
      if (!user) {
        return res.status(401).json({ error: 'Your account no longer exists.' });
      }
      return res.json({ user: toUserDTO(user) });
    })
  );

  // JWTs are stateless. The client discards its token; this endpoint exists so
  // clients have one explicit place to end a session.
  app.post('/api/auth/logout', (req, res) => res.json({ success: true }));

  // ---------- Authenticated scopes ----------
  app.use('/api/notes', authenticate, withRepos);
  app.use('/api/todos', authenticate, withRepos);
  app.use('/api/ai', authenticate, withRepos);

  // ---------- Notes ----------
  app.get(
    '/api/notes',
    wrap(async (req, res) => {
      res.json(await req.repos.notes.list());
    })
  );

  app.post(
    '/api/notes',
    wrap(async (req, res) => {
      res.status(201).json(await req.repos.notes.create(req.body ?? {}));
    })
  );

  app.put(
    '/api/notes/:id',
    wrap(async (req, res) => {
      const note = await req.repos.notes.update(req.params.id, req.body ?? {});
      if (!note) return res.status(404).json({ error: 'Note not found' });
      return res.json(note);
    })
  );

  app.delete(
    '/api/notes/:id',
    wrap(async (req, res) => {
      const removed = await req.repos.notes.remove(req.params.id);
      if (!removed) return res.status(404).json({ error: 'Note not found' });
      return res.json({ success: true });
    })
  );

  // ---------- Todos ----------
  app.get(
    '/api/todos',
    wrap(async (req, res) => {
      res.json(await req.repos.todos.list());
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
      return res.json(await req.repos.todos.reorder(incoming));
    })
  );

  app.post(
    '/api/todos',
    wrap(async (req, res) => {
      const result = await req.repos.todos.create(req.body ?? {});
      if (!result.ok) return res.status(400).json({ error: 'Todo text is required' });
      return res.status(201).json(result.todo);
    })
  );

  app.put(
    '/api/todos/:id',
    wrap(async (req, res) => {
      const result = await req.repos.todos.update(req.params.id, req.body ?? {});
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
      const removed = await req.repos.todos.remove(req.params.id);
      if (!removed) return res.status(404).json({ error: 'Todo not found' });
      return res.json({ success: true });
    })
  );

  // ---------- AI (Gemini) ----------
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
        notes.push(await req.repos.notes.create(note));
      }

      const tasks = [];
      for (const task of [...plan.tasks].reverse()) {
        const result = await req.repos.todos.create(task);
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

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    const { status, body } = mapError(error);
    if (status >= 500 && error.status) {
      // Expected service failures (e.g. Gemini) get a concise line, not a stack.
      const detail =
        error.providerMessage && error.providerMessage !== error.message
          ? `${error.message} (${error.providerMessage})`
          : error.message;
      console.error(`API error ${status}: ${detail}`);
    } else if (status >= 500) {
      console.error(error);
    }
    res.status(status).json(body);
  });

  return app;
}

module.exports = { createApp };
