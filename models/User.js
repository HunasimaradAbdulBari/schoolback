const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true, // Allows multiple null values
    trim: true,
    lowercase: true,
    validate: {
      validator: function(email) {
        // Only validate if email is provided
        if (!email) return true;
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email);
      },
      message: 'Please enter a valid email address'
    }
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [20, 'Username cannot exceed 20 characters']
  },
  phone: {
    type: String,
    required: function() {
      return this.role === 'parent'; // Phone required for parents
    },
    validate: {
      validator: function(phone) {
        if (!phone && this.role === 'parent') return false;
        if (!phone) return true;
        return /^[6-9]\d{9}$/.test(phone); // Indian phone number format
      },
      message: 'Please enter a valid 10-digit phone number'
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  // NEW: Role-based system
  role: {
    type: String,
    enum: ['admin', 'parent'],
    default: 'admin',
    required: true
  },
  // NEW: For parent users - linked student IDs
  studentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  // NEW: For SMS gateway selection
  carrier: {
    type: String,
    enum: ['verizon', 'att', 'tmobile', 'sprint'],
    required: function() {
      return this.role === 'parent';
    }
  },
  // NEW: OTP verification status
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  // NEW: Account status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient parent-student linking
userSchema.index({ phone: 1, role: 1 });

// Keep the comparePassword method for potential future use
userSchema.methods.comparePassword = async function(password) {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(password, this.password);
};

// Add method to generate JWT token with role
userSchema.methods.generateAuthToken = function() {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { 
      userId: this._id, 
      role: this.role 
    }, 
    process.env.JWT_SECRET, 
    { expiresIn: '24h' }
  );
};

module.exports = mongoose.model('User', userSchema);
