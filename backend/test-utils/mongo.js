const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const db = require('../db');
require('../models/note');
require('../models/todo');

let server;

async function start() {
  server = await MongoMemoryServer.create();
  await db.connect(server.getUri(), { autoIndex: true });
  // Build the declared indexes before assertions run.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  return server.getUri();
}

async function stop() {
  await db.disconnect();
  if (server) {
    await server.stop();
    server = null;
  }
}

async function reset() {
  const { db: connection } = mongoose.connection;
  if (!connection) return;
  const collections = await connection.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

module.exports = { start, stop, reset };
