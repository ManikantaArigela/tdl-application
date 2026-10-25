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
  },
  { versionKey: false, timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
