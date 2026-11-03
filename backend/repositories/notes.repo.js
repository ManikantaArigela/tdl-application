const crypto = require('crypto');

const Note = require('../models/note');
const { sanitizeNote } = require('../lib/sanitize');
const { toNoteDTO } = require('../lib/dto');

/**
 * Notes repository bound to one signed-in account. Every query filters by
 * `userId`, so a leaked or guessed note id still cannot reach another user.
 */
function createNotesRepo({ userId } = {}) {
  if (!userId) throw new Error('createNotesRepo requires a user id');

  const list = async () => {
    const docs = await Note.find({ userId, trashed: { $ne: true } })
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    return docs.map(toNoteDTO);
  };

  const listTrashed = async () => {
    const docs = await Note.find({ userId, trashed: true })
      .sort({ trashedAt: -1, _id: -1 })
      .lean();
    return docs.map(toNoteDTO);
  };

  const create = async (input = {}) => {
    const note = sanitizeNote(input);
    const now = new Date();

    const doc = await Note.create({
      _id: `n_${crypto.randomUUID()}`,
      userId,
      title: note.title,
      content: note.content,
      tags: note.tags,
      pinned: note.pinned,
      archived: note.archived,
      trashed: false,
      trashedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return toNoteDTO(doc.toObject());
  };

  /** Returns the updated DTO, or null when the note does not exist for this user. */
  const update = async (id, input = {}) => {
    const existing = await Note.findOne({ _id: id, userId }).lean();
    if (!existing) return null;

    const next = sanitizeNote(input, toNoteDTO(existing));
    const updated = await Note.findOneAndUpdate(
      { _id: id, userId },
      {
        $set: {
          title: next.title,
          content: next.content,
          tags: next.tags,
          pinned: next.pinned,
          archived: next.archived,
          updatedAt: new Date(),
        },
      },
      { new: true, lean: true }
    );

    return updated ? toNoteDTO(updated) : null;
  };

  /** Soft delete: returns true when an active note was moved to Trash. */
  const remove = async (id) => {
    const result = await Note.updateOne(
      { _id: id, userId, trashed: { $ne: true } },
      { $set: { trashed: true, trashedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  };

  /** Restores a trashed note and returns it, or null when it is not in Trash. */
  const restore = async (id) => {
    const restored = await Note.findOneAndUpdate(
      { _id: id, userId, trashed: true },
      { $set: { trashed: false, trashedAt: null, updatedAt: new Date() } },
      { new: true, lean: true }
    );
    return restored ? toNoteDTO(restored) : null;
  };

  /** Permanently removes one trashed note. */
  const removePermanent = async (id) => {
    const result = await Note.deleteOne({ _id: id, userId, trashed: true });
    return result.deletedCount > 0;
  };

  /** Empties the Trash for this account and returns how many notes were removed. */
  const emptyTrash = async () => {
    const result = await Note.deleteMany({ userId, trashed: true });
    return result.deletedCount;
  };

  return { list, listTrashed, create, update, remove, restore, removePermanent, emptyTrash };
}

module.exports = { createNotesRepo };
