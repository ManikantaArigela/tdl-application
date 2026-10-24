const { test } = require('node:test');
const assert = require('node:assert/strict');

const { checkDatabase } = require('../lib/supabase');

test('checkDatabase uses a GET so a missing table is reported', async () => {
  let headOption;
  const fakeClient = {
    from(table) {
      assert.equal(table, 'notes');
      return {
        select(columns, options) {
          assert.equal(columns, 'id');
          headOption = options?.head;
          return {
            limit: async (limit) => {
              assert.equal(limit, 1);
              return {
                error: {
                  code: 'PGRST205',
                  status: 404,
                  message: "Could not find the table 'public.notes' in the schema cache",
                },
              };
            },
          };
        },
      };
    },
  };

  await assert.rejects(
    () => checkDatabase(fakeClient),
    (error) => {
      assert.equal(error.code, 'PGRST205');
      assert.equal(error.status, 404);
      assert.match(error.message, /Could not find the table/);
      return true;
    }
  );

  assert.notEqual(headOption, true, 'the readiness probe must not use HEAD');
});
