const { createSupabaseClient, isConfigured } = require('./supabase');

function readBearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;

  const [scheme, token] = header.trim().split(/\s+/);
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

/**
 * Verifies the Supabase access token sent by the browser, then attaches a
 * user-scoped Supabase client to the request. Repositories built from that
 * client inherit the user's RLS context.
 */
async function requireAuth(req, res, next) {
  if (!isConfigured()) {
    return res.status(503).json({
      error:
        'Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to backend/.env.',
    });
  }

  const token = readBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }

  try {
    const authClient = createSupabaseClient();
    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        error: 'Your session has expired. Please sign in again.',
      });
    }

    req.user = data.user;
    req.userId = data.user.id;
    req.accessToken = token;
    req.supabase = createSupabaseClient(token);
    return next();
  } catch (error) {
    const offline =
      error?.name === 'AuthRetryableFetchError' ||
      /fetch failed|network|econnrefused|enotfound/i.test(error?.message ?? '');

    if (offline || error?.status === 503) {
      return res.status(503).json({
        error: 'Authentication service is unavailable. Try again in a moment.',
      });
    }

    console.error('Auth verification failed:', error?.message ?? error);
    return res.status(401).json({
      error: 'Could not verify your session. Please sign in again.',
    });
  }
}

module.exports = { requireAuth, readBearerToken };
