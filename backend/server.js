const { createApp } = require('./app');
const db = require('./db');
const repos = require('./repositories');

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/nova_notes';
const port = Number(process.env.PORT) || 5001;

async function start() {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;

  try {
    await db.connect(uri);
  } catch (error) {
    console.error(
      `Could not connect to MongoDB at ${uri.replace(/\/\/[^@]*@/, '//***@')}: ${error.message}`
    );
    console.error('Set MONGODB_URI in backend/.env (see .env.example). Aborting.');
    process.exit(1);
  }

  const app = createApp({ repos });
  const server = app.listen(port, () => {
    console.log(`TDL backend running on http://localhost:${port} (MongoDB)`);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down.`);
    await new Promise((resolve) => server.close(resolve));
    await db.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
