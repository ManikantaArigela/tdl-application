const CONNECTION_ERRORS = new Set([
  'MongooseServerSelectionError',
  'MongoNetworkError',
  'MongoTimeoutError',
  'MongoNotConnectedError',
  'MongooseError',
]);

/**
 * Keep Express from leaking driver internals and give clients a status they can
 * branch on. Anything unrecognised stays a 500 and is logged by the caller.
 */
function mapError(error) {
  if (!error) return { status: 500, body: { error: 'Internal server error' } };

  if (error.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return { status: 400, body: { error: 'Request body is not valid JSON' } };
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern ?? error.keyValue ?? {})[0] ?? 'id';
    return { status: 409, body: { error: `A record with that ${field} already exists` } };
  }

  if (error.name === 'ValidationError') {
    const first = Object.values(error.errors ?? {})[0];
    return {
      status: 400,
      body: { error: first?.message ? `Invalid data: ${first.message}` : 'Invalid data' },
    };
  }

  if (error.name === 'CastError') {
    return { status: 400, body: { error: `Invalid value for "${error.path}"` } };
  }

  if (CONNECTION_ERRORS.has(error.name) || /buffering timed out/i.test(error.message ?? '')) {
    return { status: 503, body: { error: 'Database unavailable' } };
  }

  // Services (Gemini) attach an HTTP status to errors a client can act on.
  if (Number.isInteger(error.status) && error.status >= 400 && error.status < 600) {
    return { status: error.status, body: { error: error.message || 'Request failed' } };
  }

  return { status: 500, body: { error: 'Internal server error' } };
}

module.exports = { mapError };
