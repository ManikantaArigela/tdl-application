const { createNotesRepo } = require('./notes.repo');
const { createTodosRepo } = require('./todos.repo');

/**
 * Builds repositories scoped to a single request. The account id comes from the
 * verified JWT, and every repository filters by it.
 */
function createRepos(userId) {
  return {
    notes: createNotesRepo({ userId }),
    todos: createTodosRepo({ userId }),
  };
}

module.exports = { createRepos };
