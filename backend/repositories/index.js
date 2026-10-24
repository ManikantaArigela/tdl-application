const { createNotesRepo } = require('./notes.repo');
const { createTodosRepo } = require('./todos.repo');

/**
 * Builds repositories scoped to a single request. `supabase` carries the
 * signed-in user's JWT, so RLS and the explicit user_id filters both apply.
 */
function createRepos(supabase, userId) {
  return {
    notes: createNotesRepo({ supabase, userId }),
    todos: createTodosRepo({ supabase, userId }),
  };
}

module.exports = { createRepos };
