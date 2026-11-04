const mongoose = require('mongoose');

const reminderSettingsSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    // Web Push is independent of voice: a user can get server push without SIP.
    pushEnabled: { type: Boolean, default: true },
    // Free SIP identity, for example `alice@sip.linphone.org`.
    sipUri: { type: String, default: '', maxlength: 254 },
    voiceLanguage: {
      type: String,
      enum: ['en', 'hi', 'te', 'en-hi'],
      default: 'en',
    },
    timezone: { type: String, default: 'UTC', maxlength: 64 },
    quietStart: { type: String, default: '21:00' },
    quietEnd: { type: String, default: '08:00' },
    maxRetries: { type: Number, default: 2, min: 0, max: 3 },
    consentAt: { type: Number, default: null },
    sipVerifiedAt: { type: Number, default: null },
  },
  { _id: false }
);

const sipVerifySchema = new mongoose.Schema(
  {
    codeHash: { type: String, default: null },
    // The address the code was sent to; changing it invalidates the challenge.
    sipUri: { type: String, default: '' },
    expiresAt: { type: Number, default: null },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Number, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    // bcrypt hash. `select: false` keeps it out of accidental reads/serialisation.
    passwordHash: { type: String, required: true, select: false },
    // Editable profile. Avatar is an id from the app's predefined picker.
    name: { type: String, default: '', maxlength: 80 },
    bio: { type: String, default: '', maxlength: 280 },
    avatar: { type: String, default: '', maxlength: 64 },
    // Account-level voice reminder preferences.
    reminders: { type: reminderSettingsSchema, default: () => ({}) },
    // Server-managed SIP ownership challenge. Never serialized.
    sipVerify: { type: sipVerifySchema, default: () => ({}) },
  },
  { versionKey: false, timestamps: true }
);

userSchema.index({ 'reminders.enabled': 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
