const { createApp } = require('./app');
const { createRepos } = require('./repositories');
const db = require('./db');
const { isConfigured: isAuthConfigured } = require('./lib/auth');
const { startScheduler } = require('./services/reminders');
const ReminderEvent = require('./models/reminder-event');
const PushSubscription = require('./models/push-subscription');

const port = Number(process.env.PORT) || 5001;

async function start() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is required in backend/.env.');
    console.error('Copy backend/.env.example, add your MongoDB connection string, then retry.');
    process.exit(1);
  }

  if (!isAuthConfigured()) {
    console.error('JWT_SECRET is required in backend/.env.');
    console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
    process.exit(1);
  }

  try {
    await db.connect(uri);
    await db.ping();
    // The reminder queue's uniqueness is what prevents duplicate calls, so do
    // not start the scheduler until those indexes exist.
    await Promise.all([ReminderEvent.init(), PushSubscription.init()]).catch((error) => {
      console.warn(`[db] could not ensure reminder indexes: ${error.message}`);
    });
  } catch (error) {
    console.error(`Could not reach MongoDB at ${db.maskUri(uri)}: ${error.message}`);
    console.error('Check MONGODB_URI and the Atlas IP access list. Aborting.');
    process.exit(1);
  }

  const app = createApp({ createRepos });
  const server = app.listen(port, () => {
    console.log(`TDL backend running on http://localhost:${port} (MongoDB)`);
  });

  const stopScheduler = startScheduler();

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down.`);
    stopScheduler();
    await new Promise((resolve) => server.close(resolve));
    await db.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
