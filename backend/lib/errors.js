const DB_SETUP_CODES = new Set([
  // Postgres: relation does not exist / PostgREST: missing table in the schema cache.
  '42P01',
  'PGRST205',
]);

const isOffline = (error) =>
  error?.name === 'AuthRetryableFetchError' ||
  /fetch failed|network|econnrefused|enotfound|timeout/i.test(error?.message ?? '');

/**
 * Keep Express from leaking PostgREST internals and give clients a status they
 * can branch on. Anything unrecognised stays a 500 and is logged by the caller.
 */
function mapError(error) {
  if (!error) return { status: 500, body: { error: 'Internal server error' } };

  if (error.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return { status: 400, body: { error: 'Request body is not valid JSON' } };
  }

  if (error.code === '23505') {
    return { status: 409, body: { error: 'A record with that id already exists' } };
  }

  if (error.code === '23503') {
    return { status: 400, body: { error: 'Referenced account is missing. Sign in again.' } };
  }

  if (error.code === '23514') {
    return { status: 400, body: { error: 'Invalid data' } };
  }

  if (error.code === '23502') {
    return { status: 400, body: { error: 'A required field is missing' } };
  }

  if (
    error.code === '42501' ||
    /row-level security|permission denied/i.test(error.message ?? '')
  ) {
    return { status: 403, body: { error: 'You do not have access to that record' } };
  }

  if (
    error.code === 'PGRST301' ||
    error.code === 'PGRST302' ||
    /jwt expired|invalid jwt/i.test(error.message ?? '')
  ) {
    return { status: 401, body: { error: 'Your session has expired. Please sign in again.' } };
  }

  if (DB_SETUP_CODES.has(error.code)) {
    return {
      status: 503,
      body: { error: 'Database is not set up. Run supabase/schema.sql in your Supabase project.' },
    };
  }

  if (isOffline(error)) {
    return { status: 503, body: { error: 'Database unavailable' } };
  }

  // Services (Gemini, Supabase auth) attach an HTTP status to errors a client
  // can act on. Preserve their message; generic database errors have no status
  // and fall through to the safe 500 below.
  if (Number.isInteger(error.status) && error.status >= 400 && error.status < 600) {
    return { status: error.status, body: { error: error.message || 'Request failed' } };
  }

  return { status: 500, body: { error: 'Internal server error' } };
}

module.exports = { mapError };
