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
const { ping: pingDatabase, isConnected: isDatabaseConnected } = require('./db');
const { mapError } = require('./lib/errors');
const { toUserDTO } = require('./lib/dto');
const { sanitizeProfile } = require('./lib/sanitize');
const { createRateLimiter } = require('./lib/rate-limit');
const { users: defaultUsers } = require('./repositories/users.repo');
const { createPushRepo } = require('./repositories/push.repo');
const { createReminderEventsRepo } = require('./repositories/reminder-events.repo');
const planPolicy = require('./lib/plans');
const reminders = require('./services/reminders');
const push = require('./services/push');
const ai = require('./lib/ai-provider');
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
 *   notes: { list, listTrashed, create, update, remove, restore, removePermanent, emptyTrash }
 *   todos: { list, listTrashed, create, update, remove, restore, removePermanent, emptyTrash, reorder }
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

  // Calls cost the bot account real SIP traffic, so cap verification and test
  // calls per account even though the user owns the destination.
  const voiceLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 4 });
  const limitVoice = (req, res, next) => {
    const retryAfter = voiceLimiter(`voice:${req.userId}`);
    if (retryAfter) {
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many call requests. Wait a minute.' });
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
      res.json(ai.status());
    })
  );

  // Voice/push capability probe. Like /api/ai/status it is public and never
  // exposes credentials — only whether calling is configured.
  app.get(
    '/api/voice/status',
    wrap(async (req, res) => {
      res.json(reminders.status());
    })
  );

  app.get(
    '/api/push/key',
    wrap(async (req, res) => {
      res.json({ publicKey: push.publicKey(), configured: push.isConfigured() });
    })
  );

  /**
   * External cron entry point. A free host may sleep, so a scheduler can ping
   * this every few minutes. When CRON_SECRET is unset only localhost may call.
   */
  app.post(
    '/api/internal/tick',
    wrap(async (req, res) => {
      const secret = process.env.CRON_SECRET;
      const provided = req.get('x-cron-secret');
      const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
        req.socket.remoteAddress
      );
      // Behind a reverse proxy every request looks local, so production must
      // set CRON_SECRET. Localhost is only a development convenience.
      const allowed = secret
        ? provided === secret
        : local && process.env.NODE_ENV !== 'production';

      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const result = await reminders.runOnce();
      return res.json({ ok: true, ...result });
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

  // Demo billing: plans apply immediately and are stored on the account so
  // reminder access cannot be unlocked by editing localStorage.
  app.put(
    '/api/auth/plan',
    authenticate,
    wrap(async (req, res) => {
      if (typeof users.updatePlan !== 'function') {
        return res.status(501).json({ error: 'Plan changes are not available.' });
      }
      const plan = planPolicy.normalizePlan(req.body?.plan);
      const updated = await users.updatePlan(req.userId, plan);
      if (!updated) {
        return res.status(401).json({ error: 'Your account no longer exists.' });
      }

      // Leaving Premium must stop queued pushes and calls immediately.
      if (!planPolicy.isPremiumPlan(plan)) {
        if (typeof users.disableReminders === 'function') {
          await users.disableReminders(req.userId).catch(() => {});
        }
        if (isDatabaseConnected()) {
          await createReminderEventsRepo().cancelForUser(req.userId).catch(() => {});
        }
      }

      const fresh = await users.findById(req.userId);
      return res.json({ user: toUserDTO(fresh ?? updated) });
    })
  );

  // Editable profile. Email/password live in /api/auth; only display fields here.
  app.put(
    '/api/profile',
    authenticate,
    wrap(async (req, res) => {
      if (typeof users.update !== 'function') {
        return res.status(501).json({ error: 'Profile updates are not available.' });
      }
      const current = await users.findById(req.userId);
      if (!current) {
        return res.status(401).json({ error: 'Your account no longer exists.' });
      }
      const profile = sanitizeProfile(req.body ?? {}, current);
      const updated = await users.update(req.userId, profile);
      if (!updated) {
        return res.status(401).json({ error: 'Your account no longer exists.' });
      }
      return res.json({ user: toUserDTO(updated) });
    })
  );

  // JWTs are stateless. The client discards its token; this endpoint exists so
  // clients have one explicit place to end a session.
  app.post('/api/auth/logout', (req, res) => res.json({ success: true }));

  // ---------- Authenticated scopes ----------
  app.use('/api/notes', authenticate, withRepos);
  app.use('/api/todos', authenticate, withRepos);
  app.use('/api/ai', authenticate, withRepos);

  // ---------- Reminders (voice + push) ----------
  app.use('/api/reminders', authenticate);
  app.use('/api/push', authenticate);

  const currentUser = async (req) => {
    const user = await users.findById(req.userId);
    if (!user) {
      const error = new Error('Your account no longer exists.');
      error.status = 401;
      throw error;
    }
    return user;
  };

  app.get(
    '/api/reminders/settings',
    wrap(async (req, res) => {
      const user = await currentUser(req);
      const settings = toUserDTO(user).reminders;
      // A downgraded account may still have legacy settings; never advertise
      // reminders as enabled when the plan does not include them.
      if (!planPolicy.isPremiumPlan(user.plan)) settings.enabled = false;
      return res.json({ settings, voice: reminders.status() });
    })
  );

  app.put(
    '/api/reminders/settings',
    wrap(async (req, res) => {
      const user = await currentUser(req);
      const updated = await reminders.updateSettings(user, req.body ?? {}, users);
      return res.json({ settings: updated.reminders, voice: reminders.status() });
    })
  );

  app.post(
    '/api/reminders/sip/verify/start',
    limitVoice,
    wrap(async (req, res) => {
      const user = await currentUser(req);
      return res.json(await reminders.startVerification(user, users));
    })
  );

  app.post(
    '/api/reminders/sip/verify/confirm',
    wrap(async (req, res) => {
      const user = await currentUser(req);
      const updated = await reminders.confirmVerification(user, req.body?.code, users);
      return res.json({ user: updated, settings: updated.reminders });
    })
  );

  app.post(
    '/api/reminders/test-call',
    limitVoice,
    wrap(async (req, res) => {
      const user = await currentUser(req);
      return res.json(await reminders.sendTestCall(user));
    })
  );

  app.get(
    '/api/reminders/calls/:eventId',
    wrap(async (req, res) => {
      const user = await currentUser(req);
      const call = await reminders.getCall(user, req.params.eventId);
      if (!call) return res.status(404).json({ error: 'This call has ended or does not exist.' });
      return res.json({ call });
    })
  );

  app.post(
    '/api/reminders/calls/:eventId/answer',
    wrap(async (req, res) => {
      const user = await currentUser(req);
      return res.json({ call: await reminders.answerCall(user, req.params.eventId) });
    })
  );

  app.post(
    '/api/reminders/calls/:eventId/decline',
    wrap(async (req, res) => {
      const user = await currentUser(req);
      return res.json({ call: await reminders.declineCall(user, req.params.eventId) });
    })
  );

  app.post(
    '/api/reminders/calls/:eventId/action',
    wrap(async (req, res) => {
      const user = await currentUser(req);
      return res.json(
        await reminders.actionCall(user, req.params.eventId, req.body?.action)
      );
    })
  );

  app.get(
    '/api/reminders/events',
    wrap(async (req, res) => {
      const user = await currentUser(req);
      if (!planPolicy.isPremiumPlan(user.plan)) return res.json({ events: [] });
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      return res.json({ events: await reminders.listEvents(user._id, limit) });
    })
  );

  app.post(
    '/api/push/subscribe',
    wrap(async (req, res) => {
      const repo = createPushRepo();
      await repo.save({
        userId: req.userId,
        subscription: req.body?.subscription,
        userAgent: req.get('user-agent'),
        timezone: req.body?.timezone,
      });
      return res.status(201).json({ success: true });
    })
  );

  app.delete(
    '/api/push/subscribe',
    wrap(async (req, res) => {
      const repo = createPushRepo();
      const endpoint = req.body?.endpoint;
      if (!endpoint) return res.status(400).json({ error: 'An endpoint is required.' });
      await repo.removeByEndpoint(req.userId, endpoint);
      return res.json({ success: true });
    })
  );

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

  // Trash routes must be registered before /:id so "trash" is not read as an id.
  app.get(
    '/api/notes/trash',
    wrap(async (req, res) => {
      res.json(await req.repos.notes.listTrashed());
    })
  );

  app.delete(
    '/api/notes/trash',
    wrap(async (req, res) => {
      const removed = await req.repos.notes.emptyTrash();
      res.json({ success: true, removed });
    })
  );

  app.post(
    '/api/notes/:id/restore',
    wrap(async (req, res) => {
      const note = await req.repos.notes.restore(req.params.id);
      if (!note) return res.status(404).json({ error: 'Note not found in Trash' });
      return res.json(note);
    })
  );

  app.delete(
    '/api/notes/:id/permanent',
    wrap(async (req, res) => {
      const removed = await req.repos.notes.removePermanent(req.params.id);
      if (!removed) return res.status(404).json({ error: 'Note not found in Trash' });
      return res.json({ success: true });
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

  // Registered before /api/todos/:id so "trash" and "reorder" are not read as ids.
  app.get(
    '/api/todos/trash',
    wrap(async (req, res) => {
      res.json(await req.repos.todos.listTrashed());
    })
  );

  app.delete(
    '/api/todos/trash',
    wrap(async (req, res) => {
      const removed = await req.repos.todos.emptyTrash();
      res.json({ success: true, removed });
    })
  );

  app.post(
    '/api/todos/:id/restore',
    wrap(async (req, res) => {
      const todo = await req.repos.todos.restore(req.params.id);
      if (!todo) return res.status(404).json({ error: 'Todo not found in Trash' });
      return res.json(todo);
    })
  );

  app.delete(
    '/api/todos/:id/permanent',
    wrap(async (req, res) => {
      const removed = await req.repos.todos.removePermanent(req.params.id);
      if (!removed) return res.status(404).json({ error: 'Todo not found in Trash' });
      return res.json({ success: true });
    })
  );

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

      // Completing or rescheduling a task must silence its pending reminders.
      // Memory-backed tests have no MongoDB, so skip the queue there.
      if (isDatabaseConnected()) {
        const queue = createReminderEventsRepo();
        if (result.todo.completed) {
          await queue.cancelForTodo(req.userId, result.todo.id).catch(() => {});
        } else {
          const dueKey = reminders.dueKeyFor(result.todo);
          await queue.cancelStale(req.userId, result.todo.id, dueKey).catch(() => {});
          // Re-opening a completed task should arm its reminders again.
          await queue.reopenForTodo(req.userId, result.todo.id, dueKey).catch(() => {});
        }
      }

      return res.json(result.todo);
    })
  );

  app.delete(
    '/api/todos/:id',
    wrap(async (req, res) => {
      const removed = await req.repos.todos.remove(req.params.id);
      if (!removed) return res.status(404).json({ error: 'Todo not found' });
      if (isDatabaseConnected()) {
        await createReminderEventsRepo()
          .cancelForTodo(req.userId, req.params.id)
          .catch(() => {});
      }
      return res.json({ success: true });
    })
  );

  // ---------- AI (Gemini / Groq / OpenRouter) ----------
  /**
   * Turns a topic or an uploaded file into notes + tasks and saves both.
   * The browser never sees an API key; the configured AI provider is called
   * server-side with automatic fallback between free tiers.
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
      const raw = await ai.generateJson({
        prompt: buildPlanPrompt({ topic, fileName: hasFile ? file.name : null }),
        files,
      });

      const plan = normalizePlan(raw);
      if (plan.notes.length === 0 && plan.tasks.length === 0) {
        return res.status(422).json({
          error: 'The AI did not return a usable plan. Try rephrasing the topic.',
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

      const raw = await ai.generateJson({
        prompt: buildEnhancePrompt({ title, content }),
      });
      const improved = normalizeContent(raw);
      if (!improved) {
        return res.status(422).json({ error: 'The AI returned an empty note. Try again.' });
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

      const raw = await ai.generateJson({
        prompt:
          collection.length > 0
            ? buildSummarizeAllPrompt({ notes: collection })
            : buildSummarizeNotePrompt({ title, content }),
      });
      const summary = normalizeSummary(raw);
      if (!summary) {
        return res.status(422).json({ error: 'The AI returned an empty summary. Try again.' });
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
      // Expected service failures (e.g. an AI provider) get a concise line, not a stack.
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
