const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  // 🆕 NEW: Student ID field - Required and unique
  studentId: {
    type: String,
    required: [true, 'Student ID is required'],
    unique: true,
    trim: true,
    validate: {
      validator: function(id) {
        // Must start with "AS" and be exactly 6 characters
        return /^AS.{4}$/.test(id);
      },
      message: 'Student ID must be in format AS followed by 4 characters (e.g., AS1234)'
    }
  },
  name: {
    type: String,
    required: true,
  },
  class: {
    type: String,
    required: true,
    enum: ['Play Group', 'Nursery', 'LKG', 'UKG'],
  },
  feePaid: {
    type: Number,
    required: true,
    default: 0,
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  parentName: {
    type: String,
    required: true,
  },
  parentPhone: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  bloodGroup: {
    type: String,
    required: true,
  },
  allergies: {
    type: String,
    default: '',
  },
  studentPhoto: {
    type: String,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}, {
  timestamps: true,
});

// 🆕 NEW: Add index for faster Student ID queries
studentSchema.index({ studentId: 1 });

module.exports = mongoose.model('Student', studentSchema);