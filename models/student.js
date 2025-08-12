const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
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
  // 🔧 FIXED: Made optional fields actually optional to prevent validation errors
  parentName: {
    type: String,
    required: false, // Changed from true to false
    default: '', // Added default empty string
  },
  parentPhone: {
    type: String,
    required: false, // Changed from true to false
    default: '', // Added default empty string
  },
  address: {
    type: String,
    required: false, // Changed from true to false
    default: '', // Added default empty string
  },
  dateOfBirth: {
    type: Date,
    required: false, // Changed from true to false
    default: null, // Added default null
  },
  bloodGroup: {
    type: String,
    required: false, // Changed from true to false
    default: '', // Added default empty string
    enum: {
      values: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      message: 'Invalid blood group'
    }
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

// 🔧 ADDED: Pre-save middleware to handle empty strings properly
studentSchema.pre('save', function(next) {
  // Convert empty strings to null for date fields
  if (this.dateOfBirth === '') {
    this.dateOfBirth = null;
  }
  
  // Ensure bloodGroup enum validation works with empty strings
  if (this.bloodGroup === '') {
    this.bloodGroup = '';
  }
  
  next();
});

module.exports = mongoose.model('Student', studentSchema);