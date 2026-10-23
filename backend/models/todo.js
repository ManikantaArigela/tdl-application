const mongoose = require('mongoose');

const { LIMITS, PRIORITIES, REPEATS } = require('../lib/sanitize');

const todoSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    text: { type: String, required: true, trim: true, maxlength: LIMITS.todo },
    priority: {
      type: String,
      enum: [...PRIORITIES],
      default: 'medium',
    },
    completed: { type: Boolean, default: false },
    // Stored as a string on purpose: the API has always returned string|null.
    dueDate: { type: String, default: null },
    dueTime: { type: String, default: null },
    repeat: {
      type: String,
      enum: [...REPEATS],
      default: 'none',
    },
    completedAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
    order: { type: Number, required: true },
  },
  { versionKey: false, timestamps: false }
);

// Canonical list order; ties are broken deterministically.
todoSchema.index({ order: 1, createdAt: 1, _id: 1 });
todoSchema.index({ completed: 1, order: 1 });
todoSchema.index({ dueDate: 1 });

module.exports = mongoose.models.Todo || mongoose.model('Todo', todoSchema);
