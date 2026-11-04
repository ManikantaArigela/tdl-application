const mongoose = require('mongoose');

/**
 * A browser push subscription. The endpoint is the stable identity, so
 * re-subscribing updates the row instead of creating duplicates.
 */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    endpoint: { type: String, required: true, unique: true, maxlength: 2048 },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: '' },
    timezone: { type: String, default: '' },
    lastSeenAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, timestamps: false }
);

pushSubscriptionSchema.index({ userId: 1, createdAt: 1 });

module.exports =
  mongoose.models.PushSubscription ||
  mongoose.model('PushSubscription', pushSubscriptionSchema);
