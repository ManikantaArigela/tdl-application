const mongoose = require('mongoose');

const { LIMITS } = require('../lib/sanitize');

const noteSchema = new mongoose.Schema(
  {
    // Kept as the string id the API already exposes ("n_<uuid>").
    _id: { type: String, required: true },
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

// List view: archived filter + newest-first, pinned grouping happens in the client.
noteSchema.index({ archived: 1, pinned: -1, updatedAt: -1 });
noteSchema.index({ pinned: -1, updatedAt: -1 });
noteSchema.index({ tags: 1 });

module.exports = mongoose.models.Note || mongoose.model('Note', noteSchema);
