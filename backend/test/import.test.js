const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const mongo = require('../test-utils/mongo');
const Note = require('../models/note');
const Todo = require('../models/todo');

const script = path.join(__dirname, '..', 'scripts', 'import-json.js');

let uri;
let dataDir;

const runImport = (extra = [], env = {}) =>
  execFileSync(process.execPath, [script, '--data-dir', dataDir, ...extra], {
    env: { ...process.env, MONGODB_URI: uri, NODE_ENV: 'test', ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

before(
  async () => {
    uri = await mongo.start();
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-import-test-'));
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongo.stop();
  if (dataDir) await fs.rm(dataDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await mongo.reset();

  await fs.writeFile(
    path.join(dataDir, 'notes.json'),
    JSON.stringify([
      {
        id: 'n_fixed_1',
        title: 'Legacy note',
        content: 'from json',
        tags: ['old', 'old'],
        pinned: true,
        archived: false,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000,
      },
    ])
  );

  await fs.writeFile(
    path.join(dataDir, 'todos.json'),
    JSON.stringify([
      {
        id: 't_fixed_1',
        text: 'Legacy todo',
        priority: 'high',
        completed: false,
        dueDate: '2026-11-01',
        createdAt: 1_700_000_000_000,
      },
      {
        id: 't_fixed_2',
        text: 'Done todo',
        priority: 'urgent',
        completed: true,
        completedAt: 1_700_000_500_000,
        createdAt: 1_700_000_200_000,
      },
    ])
  );
});

test('import preserves ids, timestamps, sanitization and order', async () => {
  runImport();

  const notes = await Note.find().lean();
  assert.equal(notes.length, 1);
  assert.equal(notes[0]._id, 'n_fixed_1');
  assert.deepEqual(notes[0].tags, ['old']);
  assert.equal(notes[0].createdAt.getTime(), 1_700_000_000_000);
  assert.equal(notes[0].updatedAt.getTime(), 1_700_000_100_000);

  const todos = await Todo.find().sort({ order: 1 }).lean();
  assert.equal(todos.length, 2);
  assert.equal(todos[0]._id, 't_fixed_1');
  assert.equal(todos[0].order, 0);
  assert.equal(todos[1].order, 1);
  assert.equal(todos[1].priority, 'medium'); // invalid enum fell back
  assert.equal(todos[1].completedAt.getTime(), 1_700_000_500_000);
});

test('import is idempotent', async () => {
  runImport();
  const before = await Promise.all([Note.countDocuments(), Todo.countDocuments()]);

  runImport();
  const after = await Promise.all([Note.countDocuments(), Todo.countDocuments()]);

  assert.deepEqual(after, before);
  assert.deepEqual(after, [1, 2]);
});

test('dry run validates without writing or connecting', async () => {
  const output = runImport(['--dry-run'], { MONGODB_URI: 'mongodb://127.0.0.1:1/nope' });
  assert.match(output, /Dry run: nothing written/);
  assert.equal(await Note.countDocuments(), 0);
});

test('invalid JSON aborts with a non-zero exit code', async () => {
  await fs.writeFile(path.join(dataDir, 'notes.json'), '{ not json');

  assert.throws(
    () => runImport(),
    (error) => {
      assert.equal(error.status, 1);
      assert.match(error.stderr, /invalid JSON/);
      return true;
    }
  );

  assert.equal(await Note.countDocuments(), 0);
});
