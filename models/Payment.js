const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Payment identification
  receiptNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  // Student and parent references
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Payment details
  amount: {
    type: Number,
    required: true,
    min: [1, 'Payment amount must be positive']
  },
  
  // Payment status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  // Payment method
  method: {
    type: String,
    enum: ['upi', 'cash', 'bank_transfer'],
    default: 'upi'
  },
  
  // UPI payment details
  upiTransactionId: {
    type: String,
    default: null
  },
  
  // Payment purpose
  purpose: {
    type: String,
    required: true,
    default: 'School Fee Payment'
  },
  
  // Payment notes
  notes: {
    type: String,
    default: ''
  },
  
  // Verification details
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  verifiedAt: {
    type: Date,
    default: null
  },
  
  // Payment confirmation
  confirmedByParent: {
    type: Boolean,
    default: false
  },
  
  confirmedAt: {
    type: Date,
    default: null
  },
  
  // Academic year/month tracking
  academicYear: {
    type: String,
    default: function() {
      const now = new Date();
      const year = now.getFullYear();
      return `${year}-${year + 1}`;
    }
  },
  
  paymentMonth: {
    type: String,
    default: function() {
      const now = new Date();
      return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  }
}, {
  timestamps: true
});

// Generate unique receipt number before saving
paymentSchema.pre('save', async function(next) {
  if (!this.receiptNumber) {
    const count = await mongoose.model('Payment').countDocuments();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.receiptNumber = `AP${date}${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// REMOVED MANUAL INDEX CREATION - Let MongoDB handle it automatically
// This prevents the duplicate index warning

module.exports = mongoose.model('Payment', paymentSchema);
