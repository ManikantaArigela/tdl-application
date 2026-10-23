const mongoose = require('mongoose');

const PING_TIMEOUT_MS = 2_000;

let connecting = null;

async function connect(uri, options = {}) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connecting) return connecting;

  connecting = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 5_000,
      maxPoolSize: 10,
      // Building indexes on every boot is fine locally, not in production.
      autoIndex: process.env.NODE_ENV !== 'production',
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

/** Health probe that cannot hang the request: bounded by PING_TIMEOUT_MS. */
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

module.exports = { connect, disconnect, isConnected, ping, PING_TIMEOUT_MS };
