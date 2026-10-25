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
    const docs = await Note.find({ userId }).sort({ createdAt: -1, _id: -1 }).lean();
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

  /** Returns true when a document was removed. */
  const remove = async (id) => {
    const result = await Note.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  };

  return { list, create, update, remove };
}

module.exports = { createNotesRepo };
