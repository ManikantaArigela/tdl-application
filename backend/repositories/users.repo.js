const User = require('../models/user');

/**
 * Account store. Kept separate from the per-request note/todo repositories
 * because authentication happens before a user id exists.
 */
const users = {
  async create({ email, passwordHash }) {
    const doc = await User.create({ email, passwordHash });
    return doc.toObject();
  },

  async findByEmail(email, { withPassword = false } = {}) {
    const query = User.findOne({ email });
    if (withPassword) query.select('+passwordHash');
    return query.lean();
  },

  async findById(id) {
    return User.findById(id).lean();
  },

  /** Profile edits only; email and password hash are immutable here. */
  async update(id, input) {
    const doc = await User.findByIdAndUpdate(
      id,
      { $set: input },
      { new: true, runValidators: true }
    ).lean();
    return doc;
  },

  /** Demo billing: the chosen plan is stored on the account immediately. */
  async updatePlan(id, plan) {
    return User.findByIdAndUpdate(
      id,
      { $set: { plan } },
      { new: true, runValidators: true, lean: true }
    );
  },

  /** Replaces the account's reminder settings (already sanitized). */
  async updateReminders(id, reminders) {
    return User.findByIdAndUpdate(
      id,
      { $set: { reminders } },
      { new: true, runValidators: true, lean: true }
    );
  },

  /** Stores the SIP ownership challenge. The code itself is never persisted. */
  async setSipVerify(id, sipVerify) {
    return User.findByIdAndUpdate(
      id,
      { $set: { sipVerify } },
      { new: true, lean: true }
    );
  },

  async clearSipVerify(id) {
    return User.findByIdAndUpdate(
      id,
      { $set: { sipVerify: { codeHash: null, expiresAt: null, attempts: 0, lastSentAt: null } } },
      { new: true, lean: true }
    );
  },

  async markSipVerified(id) {
    return User.findByIdAndUpdate(
      id,
      {
        $set: {
          'reminders.sipVerifiedAt': Date.now(),
          sipVerify: { codeHash: null, expiresAt: null, attempts: 0, lastSentAt: null },
        },
      },
      { new: true, lean: true }
    );
  },

  /** "Press 9" and the profile toggle both land here. */
  async disableReminders(id) {
    return User.findByIdAndUpdate(
      id,
      { $set: { 'reminders.enabled': false } },
      { new: true, lean: true }
    );
  },

  async removeById(id) {
    const result = await User.deleteOne({ _id: id });
    return result.deletedCount > 0;
  },
};

module.exports = { users };
