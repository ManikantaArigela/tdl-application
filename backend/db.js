const mongoose = require('mongoose');

const PING_TIMEOUT_MS = 2_000;

let connecting = null;

/** Hides the credentials in a MongoDB connection string before logging it. */
function maskUri(uri = '') {
  return String(uri).replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@');
}

async function connect(uri, options = {}) {
  if (!uri) throw new Error('MONGODB_URI is required');

  // Reuse an existing connection (important for tests and hot reloads).
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connecting) return connecting;

  connecting = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
      // Creating indexes is idempotent and keeps a fresh deployment correct.
      // Set MONGO_AUTO_INDEX=false if an operator manages indexes separately.
      autoIndex: process.env.MONGO_AUTO_INDEX !== 'false',
      ...options,
    })
    .then(() => mongoose.connection)
    .finally(() => {
      connecting = null;
    });

  return connecting;
}

async function disconnect() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Health probe that cannot hang a request: the admin ping is bounded by
 * PING_TIMEOUT_MS, so a stalled Atlas cluster answers 503 instead of hanging.
 */
async function ping() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');

  let timer;
  try {
    await Promise.race([
      db.admin().ping(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('MongoDB ping timed out')), PING_TIMEOUT_MS);
        if (typeof timer.unref === 'function') timer.unref();
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  return true;
}

module.exports = { connect, disconnect, isConnected, ping, maskUri, PING_TIMEOUT_MS };
