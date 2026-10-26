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

  async removeById(id) {
    const result = await User.deleteOne({ _id: id });
    return result.deletedCount > 0;
  },
};

module.exports = { users };
