const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true // Ensure usernames are unique
  },
  phone: {
  type: String,
  required: true
},

  password: {
    type: String,
    required: true
  }
});

// ✅ REMOVE PRE-SAVE HOOK TO AVOID DOUBLE HASHING
// The password is already being hashed in the authController
// userSchema.pre('save', async function(next) {
//   if (!this.isModified('password')) return next();
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);