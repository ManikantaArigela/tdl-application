const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    // bcrypt hash. `select: false` keeps it out of accidental reads/serialisation.
    passwordHash: { type: String, required: true, select: false },
    // Editable profile. Avatar is an id from the app's predefined picker.
    name: { type: String, default: '', maxlength: 80 },
    bio: { type: String, default: '', maxlength: 280 },
    avatar: { type: String, default: '', maxlength: 64 },
  },
  { versionKey: false, timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
