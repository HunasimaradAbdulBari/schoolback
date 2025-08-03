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

module.exports = mongoose.model('Student', studentSchema);