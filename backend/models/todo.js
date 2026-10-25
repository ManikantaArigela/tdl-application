const mongoose = require('mongoose');

const { LIMITS, PRIORITIES, REPEATS } = require('../lib/sanitize');

const todoSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
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
    // Sparse manual order: new todos go above the current top without shifting.
    sortOrder: { type: Number, required: true },
  },
  { versionKey: false, timestamps: false }
);

// Canonical order for one account; ties are broken deterministically.
todoSchema.index({ userId: 1, sortOrder: 1, createdAt: 1, _id: 1 });
todoSchema.index({ userId: 1, completed: 1, sortOrder: 1 });
todoSchema.index({ userId: 1, dueDate: 1 });

module.exports = mongoose.models.Todo || mongoose.model('Todo', todoSchema);
