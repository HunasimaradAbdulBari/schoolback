const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: false, // Made optional for backward compatibility
    unique: true,
    sparse: true // Allows multiple null values
  },
  username: {
    type: String,
    required: true,
    unique: true // Ensure usernames are unique
  },
  phone: {
    type: String,
    required: false // Made optional since we're removing OTP
  },
  password: {
    type: String,
    required: true
  }
});

// ✅ REMOVE PRE-SAVE HOOK TO AVOID DOUBLE HASHING
// The password is already being hashed in the authController

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);