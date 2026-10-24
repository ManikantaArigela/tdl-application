const { createApp } = require('./app');
const { createRepos } = require('./repositories');
const { isConfigured, checkDatabase } = require('./lib/supabase');

const port = Number(process.env.PORT) || 5001;

async function start() {
  if (!isConfigured()) {
    console.error('SUPABASE_URL and SUPABASE_ANON_KEY are required in backend/.env.');
    console.error('Copy backend/.env.example, fill in your project keys, then run supabase/schema.sql.');
    process.exit(1);
  }

  try {
    await checkDatabase();
  } catch (error) {
    console.error(`Could not reach Supabase: ${error.message}`);
    console.error('Check SUPABASE_URL / SUPABASE_ANON_KEY. If the tables are missing,');
    console.error('run supabase/schema.sql in the Supabase SQL Editor. Aborting.');
    process.exit(1);
  }

  const app = createApp({ createRepos });
  const server = app.listen(port, () => {
    console.log(`TDL backend running on http://localhost:${port} (Supabase)`);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down.`);
    await new Promise((resolve) => server.close(resolve));
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
