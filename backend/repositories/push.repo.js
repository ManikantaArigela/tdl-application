const crypto = require('crypto');

const PushSubscription = require('../models/push-subscription');

/**
 * Push endpoints are supplied by the browser, but they are still attacker
 * controlled. Only allow public HTTPS URLs so the backend cannot be used to
 * POST to an internal address.
 */
function isSafeEndpoint(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (host === '::1' || host.startsWith('[')) return false;
  return true;
}

/** Per-account browser push subscriptions. */
function createPushRepo() {
  const save = async ({ userId, subscription, userAgent = '', timezone = '' }) => {
    const endpoint = subscription?.endpoint;
    const keys = subscription?.keys ?? {};
    if (
      typeof endpoint !== 'string' ||
      endpoint.length > 2048 ||
      !keys.p256dh ||
      !keys.auth ||
      !isSafeEndpoint(endpoint)
    ) {
      const error = new Error('A valid push subscription is required.');
      error.status = 400;
      throw error;
    }

    // A single account should not be able to register an unbounded number of
    // endpoints and turn every reminder into a fan-out.
    const existing = await PushSubscription.findOne({ endpoint }).select('_id').lean();
    if (!existing) {
      const count = await PushSubscription.countDocuments({ userId });
      if (count >= 10) {
        const error = new Error('Too many notification devices. Remove one and try again.');
        error.status = 400;
        throw error;
      }
    }

    const now = new Date();
    return PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          userId,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          userAgent: String(userAgent || '').slice(0, 300),
          timezone: String(timezone || '').slice(0, 64),
          lastSeenAt: now,
        },
        $setOnInsert: {
          _id: `ps_${crypto.randomUUID()}`,
          endpoint,
          createdAt: now,
        },
      },
      { upsert: true, new: true, lean: true, setDefaultsOnInsert: true }
    );
  };

  const listByUser = async (userId) => PushSubscription.find({ userId }).lean();

  const removeByEndpoint = async (userId, endpoint) => {
    const result = await PushSubscription.deleteOne({ userId, endpoint });
    return result.deletedCount > 0;
  };

  const removeById = async (userId, id) => {
    const result = await PushSubscription.deleteOne({ userId, _id: id });
    return result.deletedCount > 0;
  };

  return { save, listByUser, removeByEndpoint, removeById };
}

module.exports = { createPushRepo };
