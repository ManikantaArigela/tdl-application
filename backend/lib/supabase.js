const { createClient } = require('@supabase/supabase-js');

/**
 * Supabase access.
 *
 * The API deliberately runs with the public anon key and the signed-in user's
 * access token. That keeps the service-role key out of the app entirely: every
 * query is evaluated by Row Level Security as that user. The repositories still
 * filter by user_id as a second line of defence.
 */

const config = () => ({
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
});

const isConfigured = () => {
  const { url, anonKey } = config();
  return Boolean(url && anonKey);
};

const notConfigured = () => {
  const error = new Error(
    'Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to backend/.env.'
  );
  error.status = 503;
  return error;
};

/**
 * Builds a fresh client. Pass an access token to act as that user; omit it for
 * public calls such as token verification and the health probe.
 */
function createSupabaseClient(accessToken = null) {
  const { url, anonKey } = config();
  if (!url || !anonKey) throw notConfigured();

  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };

  if (accessToken) {
    options.global = { headers: { Authorization: `Bearer ${accessToken}` } };
  }

  return createClient(url, anonKey, options);
}

/**
 * Lightweight readiness probe. A miss on RLS still succeeds; only a transport,
 * key, or missing-table failure throws.
 *
 * Use a GET, not a HEAD request: PostgREST answers HEAD with 204 even when the
 * table is absent, which would hide a missing schema. Accepts an optional
 * client so the error path can be tested without a live project.
 */
async function checkDatabase(client = null) {
  const supabase = client || createSupabaseClient();
  const { error } = await supabase
    .from('notes')
    .select('id')
    .limit(1);

  if (error) {
    const wrapped = new Error(error.message || 'Supabase query failed');
    wrapped.code = error.code;
    wrapped.status = error.status;
    throw wrapped;
  }

  return true;
}

module.exports = {
  isConfigured,
  createSupabaseClient,
  checkDatabase,
};
