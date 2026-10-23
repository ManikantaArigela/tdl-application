const crypto = require('crypto');

const Note = require('../models/note');
const { sanitizeNote } = require('../lib/sanitize');
const { toNoteDTO } = require('../lib/dto');

const list = async () => {
  const docs = await Note.find().sort({ createdAt: -1, _id: -1 }).lean();
  return docs.map(toNoteDTO);
};

const create = async (input = {}) => {
  const now = new Date();
  const doc = await Note.create({
    _id: `n_${crypto.randomUUID()}`,
    ...sanitizeNote(input),
    createdAt: now,
    updatedAt: now,
  });
  return toNoteDTO(doc.toObject());
};

/** Returns the updated DTO, or null when the note does not exist. */
const update = async (id, input = {}) => {
  const existing = await Note.findById(id).lean();
  if (!existing) return null;

  const updated = await Note.findOneAndUpdate(
    { _id: id },
    { $set: { ...sanitizeNote(input, toNoteDTO(existing)), updatedAt: new Date() } },
    { new: true, lean: true }
  );
  return updated ? toNoteDTO(updated) : null;
};

/** Returns true when a document was removed. */
const remove = async (id) => {
  const result = await Note.deleteOne({ _id: id });
  return result.deletedCount > 0;
};

module.exports = { list, create, update, remove };
