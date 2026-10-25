const mongoose = require('mongoose');

const { LIMITS } = require('../lib/sanitize');

const noteSchema = new mongoose.Schema(
  {
    // Kept as the string id the API has always exposed ("n_<uuid>").
    _id: { type: String, required: true },
    // Every document belongs to exactly one account. Repositories always query
    // with this field, so one user can never read another user's notes.
    userId: { type: String, required: true, index: true },
    title: { type: String, default: '', maxlength: LIMITS.title },
    content: { type: String, default: '', maxlength: LIMITS.content },
    tags: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false, timestamps: false }
);

// Primary list query: one user's notes, newest first.
noteSchema.index({ userId: 1, createdAt: -1, _id: -1 });
noteSchema.index({ userId: 1, archived: 1, updatedAt: -1 });
noteSchema.index({ userId: 1, tags: 1 });

module.exports = mongoose.models.Note || mongoose.model('Note', noteSchema);
