const crypto = require('crypto');

const ReminderEvent = require('../models/reminder-event');

/**
 * Reminder queue. `create` is deliberately duplicate-tolerant: the unique
 * `{userId, dueKey, stage}` index turns a repeated scheduler tick into a no-op.
 */
function createReminderEventsRepo() {
  const create = async ({
    userId,
    todoId,
    dueKey,
    stage,
    channel,
    scheduledFor,
    script = '',
    attempt = 0,
  }) => {
    const now = new Date();
    try {
      const doc = await ReminderEvent.create({
        _id: `re_${crypto.randomUUID()}`,
        userId,
        todoId,
        dueKey,
        stage,
        channel,
        scheduledFor: new Date(scheduledFor),
        status: 'queued',
        attempt,
        script,
        createdAt: now,
        updatedAt: now,
      });
      return doc.toObject();
    } catch (error) {
      if (error?.code === 11000) return null;
      throw error;
    }
  };

  /**
   * Create a queued row, or correct its time if one already exists. The
   * scheduler is stateless, so a changed timezone or a fixed due-time parser
   * must be able to move an already-queued row without waiting for a new
   * `dueKey`. Sent/failed rows are never reopened.
   */
  const schedule = async ({
    userId,
    todoId,
    dueKey,
    stage,
    channel,
    scheduledFor,
    script = '',
    attempt = 0,
  }) => {
    const now = new Date();
    try {
      const doc = await ReminderEvent.findOneAndUpdate(
        { userId, todoId, dueKey, stage, status: 'queued' },
        {
          $set: { scheduledFor: new Date(scheduledFor), updatedAt: now },
          $setOnInsert: {
            _id: `re_${crypto.randomUUID()}`,
            channel,
            attempt,
            script,
            createdAt: now,
          },
        },
        { upsert: true, new: true }
      ).lean();
      return doc;
    } catch (error) {
      // Another tick inserted the row first, or it is no longer queued.
      if (error?.code === 11000) return null;
      throw error;
    }
  };

  /** Atomically moves up to `limit` due rows to `processing`. */
  const claimDue = async (now = new Date(), limit = 25) => {
    const claimed = [];
    for (let index = 0; index < limit; index += 1) {
      const doc = await ReminderEvent.findOneAndUpdate(
        { status: 'queued', scheduledFor: { $lte: now } },
        { $set: { status: 'processing', startedAt: new Date(), updatedAt: new Date() } },
        { sort: { scheduledFor: 1 }, new: true, lean: true }
      );
      if (!doc) break;
      claimed.push(doc);
    }
    return claimed;
  };

  /**
   * A process that dies after claiming a row leaves it in `processing`. Put
   * those rows back after a grace period so reminders are not silently lost.
   */
  const requeueStale = async (olderThanMs = 10 * 60 * 1000) =>
    ReminderEvent.updateMany(
      { status: 'processing', startedAt: { $lt: new Date(Date.now() - olderThanMs) } },
      { $set: { status: 'queued', startedAt: null, updatedAt: new Date() } }
    );

  const update = async (id, patch = {}) =>
    ReminderEvent.findByIdAndUpdate(
      id,
      { $set: { ...patch, updatedAt: new Date() } },
      { new: true, lean: true }
    );

  const findById = async (id) => ReminderEvent.findById(id).lean();

  const listByUser = async (userId, limit = 25) =>
    ReminderEvent.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();

  /**
   * When a task's due moment changes, every row created for the previous
   * `dueKey` is obsolete. Rows for the current key (including retries and
   * snoozes) are untouched.
   */
  const cancelStale = async (userId, todoId, dueKey) =>
    ReminderEvent.updateMany(
      { userId, todoId, dueKey: { $ne: dueKey }, status: 'queued' },
      { $set: { status: 'skipped', updatedAt: new Date() } }
    );

  /** Cancel one queued stage that can no longer be delivered on time. */
  const cancelStage = async (userId, todoId, dueKey, stage) =>
    ReminderEvent.updateMany(
      { userId, todoId, dueKey, stage, status: 'queued' },
      { $set: { status: 'skipped', updatedAt: new Date() } }
    );

  /** A completed/deleted task should never ring afterwards. */
  const cancelForTodo = async (userId, todoId) =>
    ReminderEvent.updateMany(
      { userId, todoId, status: { $in: ['queued', 'processing'] } },
      { $set: { status: 'skipped', updatedAt: new Date() } }
    );

  /**
   * Re-opening a task must be able to re-arm its reminders. `cancelForTodo`
   * leaves rows behind so the unique index still blocks new ones, so future
   * rows for the current due key go back to `queued`; past rows are removed
   * and the scheduler re-creates them only while they are still useful.
   */
  const reopenForTodo = async (userId, todoId, dueKey, now = new Date()) => {
    await ReminderEvent.deleteMany({
      userId,
      todoId,
      dueKey,
      status: 'skipped',
      scheduledFor: { $lte: now },
    });
    await ReminderEvent.updateMany(
      {
        userId,
        todoId,
        dueKey,
        status: 'skipped',
        scheduledFor: { $gt: now },
      },
      { $set: { status: 'queued', updatedAt: new Date() } }
    );
  };

  const countCallsSince = async (userId, since) =>
    ReminderEvent.countDocuments({
      userId,
      channel: 'call',
      createdAt: { $gte: new Date(since) },
      status: { $nin: ['skipped'] },
    });

  const latestForTodo = async (userId, todoId) =>
    ReminderEvent.findOne({ userId, todoId, channel: 'call' })
      .sort({ createdAt: -1 })
      .lean();

  return {
    create,
    schedule,
    claimDue,
    requeueStale,
    update,
    findById,
    listByUser,
    cancelStale,
    cancelStage,
    cancelForTodo,
    reopenForTodo,
    countCallsSince,
    latestForTodo,
  };
}

module.exports = { createReminderEventsRepo };
