const Todo = require('../models/todo');
const User = require('../models/user');
const PushSubscription = require('../models/push-subscription');

/**
 * The only cross-user read path in the app. It is used by the scheduler, never
 * by an HTTP request handler, and returns no data to a client directly.
 */
const scheduler = {
  /** Accounts that opted in and verified a SIP address. */
  async listVoiceUsers() {
    return User.find({
      'reminders.enabled': true,
      'reminders.sipUri': { $ne: '' },
      'reminders.sipVerifiedAt': { $ne: null },
    }).lean();
  },

  /**
   * Push is independent of voice. Only accounts with a browser subscription or
   * voice enabled need scheduling, which keeps the tick small on a public app.
   */
  async listSchedulerUsers() {
    const subscribed = await PushSubscription.distinct('userId');
    return User.find({
      $or: [
        { _id: { $in: subscribed }, 'reminders.pushEnabled': { $ne: false } },
        { 'reminders.enabled': true },
      ],
    }).lean();
  },

  async findUserById(id) {
    return User.findById(id).lean();
  },

  async listTodosForUser(userId, { fromDate, toDate }) {
    return Todo.find({
      userId,
      completed: false,
      trashed: { $ne: true },
      dueDate: { $ne: null, $gte: fromDate, $lte: toDate },
    })
      .select('_id text dueDate dueTime repeat')
      .lean();
  },

  async findTodo(userId, todoId) {
    return Todo.findOne({ _id: todoId, userId }).lean();
  },
};

module.exports = { scheduler };
