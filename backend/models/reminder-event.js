const mongoose = require('mongoose');

/**
 * One row per reminder moment. The unique index on
 * `{ userId, dueKey, stage }` is what makes the scheduler idempotent: a tick can
 * run twice, or two workers can race, and a task is still called only once.
 */
const reminderEventSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    todoId: { type: String, required: true },
    // `${todoId}|${dueDate}|${dueTime ?? ''}` — stable across ticks.
    dueKey: { type: String, required: true },
    // push_30 | push_10 | call | retry_1 | retry_2 | snooze
    stage: { type: String, required: true },
    channel: { type: String, enum: ['push', 'call'], required: true },
    scheduledFor: { type: Date, required: true },
    status: {
      type: String,
      enum: [
        'queued',
        'processing',
        'sent',
        'dialing',
        'answered',
        'completed',
        'snoozed',
        'no_answer',
        'failed',
        'skipped',
        'opted_out',
      ],
      default: 'queued',
    },
    attempt: { type: Number, default: 0 },
    provider: { type: String, default: '' },
    providerCallId: { type: String, default: '' },
    // Rendered prompt, kept for the call history UI and debugging.
    script: { type: String, default: '' },
    error: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false, timestamps: false }
);

reminderEventSchema.index({ userId: 1, dueKey: 1, stage: 1 }, { unique: true });
reminderEventSchema.index({ status: 1, scheduledFor: 1 });
reminderEventSchema.index({ userId: 1, createdAt: -1 });
reminderEventSchema.index({ userId: 1, todoId: 1, status: 1 });

module.exports =
  mongoose.models.ReminderEvent || mongoose.model('ReminderEvent', reminderEventSchema);
