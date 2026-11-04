const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { createPushRepo } = require('../repositories/push.repo');

const VAPID_FILE = process.env.VAPID_FILE || path.join(__dirname, '..', 'var', 'vapid.json');

let cachedKeys = null;
let webpush = null;

/**
 * VAPID keys identify this server to the browser push service. They can come
 * from the environment (production) or a generated local file (development).
 * Rotating them invalidates every existing subscription.
 */
function keys() {
  if (cachedKeys) return cachedKeys;

  const envPublic = process.env.VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;
  if (envPublic && envPrivate) {
    cachedKeys = { publicKey: envPublic, privateKey: envPrivate };
    return cachedKeys;
  }

  try {
    const saved = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
    if (saved.publicKey && saved.privateKey) {
      cachedKeys = saved;
      return cachedKeys;
    }
  } catch {
    /* generate below */
  }

  const { publicKey, privateKey } = require('web-push').generateVAPIDKeys();
  cachedKeys = { publicKey, privateKey };
  try {
    fs.mkdirSync(path.dirname(VAPID_FILE), { recursive: true });
    fs.writeFileSync(VAPID_FILE, JSON.stringify(cachedKeys, null, 2), 'utf8');
    console.log(`[push] generated development VAPID keys at ${VAPID_FILE}`);
  } catch (error) {
    console.warn(`[push] could not persist VAPID keys: ${error.message}`);
  }
  return cachedKeys;
}

function client() {
  if (!webpush) {
    webpush = require('web-push');
    const { publicKey, privateKey } = keys();
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:reminders@example.com',
      publicKey,
      privateKey
    );
  }
  return webpush;
}

const isConfigured = () => Boolean(keys().publicKey && keys().privateKey);
const publicKey = () => keys().publicKey;

/** Sends one payload to every browser registered by the account. */
async function sendToUser(userId, payload) {
  if (!isConfigured()) return { sent: 0, failed: 0, skipped: true };

  const repo = createPushRepo();
  const subscriptions = await repo.listByUser(userId);
  if (subscriptions.length === 0) return { sent: 0, failed: 0, skipped: true };

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (row) => {
      try {
        await client().sendNotification(
          { endpoint: row.endpoint, keys: row.keys },
          JSON.stringify(payload)
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await repo.removeByEndpoint(userId, row.endpoint).catch(() => {});
        }
      }
    })
  );

  return { sent, failed };
}

module.exports = { sendToUser, publicKey, isConfigured, keys, hash: (value) => crypto.createHash('sha1').update(value).digest('hex') };
