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
  // Additional fields that controller expects
  parentName: {
    type: String,
    required: false,
  },
  parentPhone: {
    type: String,
    required: false,
  },
  address: {
    type: String,
    required: false,
  },
  dateOfBirth: {
    type: Date,
    required: false,
  },
  bloodGroup: {
    type: String,
    required: false,
  },
  allergies: {
    type: String,
    required: false,
  },
  studentPhoto: {
    type: String,
    required: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Student', studentSchema);