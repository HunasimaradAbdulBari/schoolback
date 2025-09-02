const User = require('../models/User');
const Student = require('../models/student');
const Otp = require('../models/Otp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Import SMS service with error handling
let smsService = null;
try {
  smsService = require('../services/smsService');
  console.log('✅ SMS Service loaded successfully');
} catch (error) {
  console.warn('⚠️ SMS Service not available:', error.message);
  // Create minimal fallback functions
  smsService = {
    validatePhoneNumber: (phone) => {
      const cleaned = phone.replace(/\D/g, '');
      if (/^[6-9]\d{9}$/.test(cleaned)) {
        return { isValid: true, cleanedNumber: cleaned, format: 'indian' };
      }
      return { isValid: false, error: 'Invalid phone number format' };
    },
    detectCarrier: () => 'airtel',
    sendOTPSMS: async () => ({ success: false, error: 'SMS service not configured' }),
    sendWelcomeSMS: async () => ({ success: false, error: 'SMS service not configured' })
  };
}

// Admin registration function (unchanged for backward compatibility)
const register = async (req, res) => {
  try {
    console.log('🔍 Admin registration attempt:', req.body);
    const { name, email, username, password } = req.body;

    // Basic validation
    if (!name || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, username, and password are required'
      });
    }

    // Password strength validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'Username already taken' 
      });
    }

    // Check if email exists (only if email is provided)
    if (email && email.trim()) {
      const existingEmail = await User.findOne({ email: email.trim() });
      if (existingEmail) {
        return res.status(400).json({ 
          success: false,
          message: 'Email already registered' 
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userData = {
      name: name.trim(),
      username: username.trim(),
      password: hashedPassword,
      role: 'admin' // Default to admin for backward compatibility
    };

    // Only add email if provided
    if (email && email.trim()) {
      userData.email = email.trim();
    }

    const user = new User(userData);
    await user.save();

    console.log('✅ Admin user registered successfully:', user.username);

    res.status(201).json({
      success: true,
      message: 'Admin user registered successfully',
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email || null,
        role: user.role
      }
    });

  } catch (err) {
    console.error('❌ Registration error:', err);
    
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }

    if (err.name === 'ValidationError') {
      const firstError = Object.values(err.errors)[0];
      return res.status(400).json({
        success: false,
        message: firstError.message
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Server error during registration' 
    });
  }
};

// Enhanced login function with role-based authentication
const login = async (req, res) => {
  try {
    console.log('🔍 Login attempt:', { username: req.body.username });
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Username and password are required' 
      });
    }

    // Find user by username, email, or phone
    const user = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: username.trim() },
        { phone: username.trim() }
      ]
    }).populate('studentIds', 'name studentId class');

    if (!user) {
      console.log('❌ User not found:', username);
      return res.status(400).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Check if account is active
    if (user.isActive === false) {
      return res.status(400).json({ 
        success: false,
        message: 'Account is deactivated. Please contact administration.' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('❌ Password mismatch for user:', username);
      return res.status(400).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Generate token with role information
    const token = jwt.sign(
      { 
        userId: user._id,
        role: user.role || 'admin' // Default to admin for existing users
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful for user:', user.username, 'Role:', user.role);

    const response = {
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        role: user.role || 'admin',
        studentIds: user.studentIds || []
      }
    };

    // Add email and phone to response if they exist
    if (user.email) response.user.email = user.email;
    if (user.phone) response.user.phone = user.phone;

    res.json(response);

  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login' 
    });
  }
};

// NEW: Send OTP for parent registration
const sendOtp = async (req, res) => {
  try {
    const { phone, carrier } = req.body;

    if (!smsService) {
      return res.status(503).json({
        success: false,
        message: 'SMS service is not configured. Please contact administrator.'
      });
    }

    // Validate phone number
    const phoneValidation = smsService.validatePhoneNumber(phone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.error
      });
    }

    const cleanedPhone = phoneValidation.cleanedNumber;

    // Check if phone already registered
    const existingUser = await User.findOne({ phone: cleanedPhone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    // Auto-detect carrier if not provided
    const selectedCarrier = carrier || smsService.detectCarrier(cleanedPhone);

    // Send OTP via SMS
    const otpResult = await smsService.sendOTPSMS(cleanedPhone, selectedCarrier);
    
    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again.'
      });
    }

    // Store OTP in database
    await Otp.deleteMany({ phone: cleanedPhone }); // Remove any existing OTPs
    const otpDoc = new Otp({
      phone: cleanedPhone,
      otp: otpResult.otp
    });
    await otpDoc.save();

    console.log('✅ OTP sent successfully to:', cleanedPhone);

    res.json({
      success: true,
      message: 'OTP sent successfully to your phone number',
      phone: cleanedPhone
    });

  } catch (error) {
    console.error('❌ Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    });
  }
};

// NEW: Verify OTP and register parent
const verifyOtpAndRegister = async (req, res) => {
  try {
    const { phone, otp, name, password, carrier } = req.body;

    // Validate required fields
    if (!phone || !otp || !name || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate phone number
    const phoneValidation = smsService.validatePhoneNumber(phone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.error
      });
    }

    const cleanedPhone = phoneValidation.cleanedNumber;

    // Verify OTP
    const otpDoc = await Otp.findOne({ 
      phone: cleanedPhone,
      otp: otp.trim()
    });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Check if phone already registered
    const existingUser = await User.findOne({ phone: cleanedPhone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    // Find students with matching parent phone for auto-linking
    const matchingStudents = await Student.find({ parentPhone: cleanedPhone });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create parent user account
    const userData = {
      name: name.trim(),
      username: cleanedPhone, // Use phone as username for parents
      phone: cleanedPhone,
      password: hashedPassword,
      role: 'parent',
      carrier: carrier || smsService.detectCarrier(cleanedPhone),
      isPhoneVerified: true,
      studentIds: matchingStudents.map(student => student._id),
      isActive: true
    };

    const user = new User(userData);
    await user.save();

    // Clean up OTP
    await Otp.deleteMany({ phone: cleanedPhone });

    // Send welcome SMS if service is available
    if (matchingStudents.length > 0 && smsService.sendWelcomeSMS) {
      const studentNames = matchingStudents.map(s => s.name).join(', ');
      try {
        await smsService.sendWelcomeSMS(cleanedPhone, userData.carrier, studentNames);
      } catch (smsError) {
        console.warn('Warning: Welcome SMS failed:', smsError.message);
      }
    }

    console.log('✅ Parent registered successfully:', cleanedPhone, 'with', matchingStudents.length, 'students');

    res.status(201).json({
      success: true,
      message: 'Registration successful! You can now login.',
      studentsLinked: matchingStudents.length,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        studentIds: user.studentIds
      }
    });

  } catch (error) {
    console.error('❌ OTP verification error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }

    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0];
      return res.status(400).json({
        success: false,
        message: firstError.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

// NEW: Resend OTP
const resendOtp = async (req, res) => {
  try {
    const { phone, carrier } = req.body;

    if (!smsService || !smsService.sendOTPSMS) {
      return res.status(503).json({
        success: false,
        message: 'SMS service is not configured'
      });
    }

    const phoneValidation = smsService.validatePhoneNumber(phone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.error
      });
    }

    const cleanedPhone = phoneValidation.cleanedNumber;
    const selectedCarrier = carrier || smsService.detectCarrier(cleanedPhone);

    // Send new OTP
    const otpResult = await smsService.sendOTPSMS(cleanedPhone, selectedCarrier);
    
    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to resend OTP. Please try again.'
      });
    }

    // Update OTP in database
    await Otp.deleteMany({ phone: cleanedPhone });
    const otpDoc = new Otp({
      phone: cleanedPhone,
      otp: otpResult.otp
    });
    await otpDoc.save();

    res.json({
      success: true,
      message: 'OTP resent successfully'
    });

  } catch (error) {
    console.error('❌ Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP'
    });
  }
};

// NEW: Link additional students to parent account
const linkStudentToParent = async (req, res) => {
  try {
    const { parentId, studentId } = req.body;

    const parent = await User.findById(parentId);
    const student = await Student.findById(studentId);

    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student is already linked
    if (parent.studentIds.includes(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Student already linked to this parent'
      });
    }

    // Add student to parent's studentIds array
    parent.studentIds.push(studentId);
    await parent.save();

    res.json({
      success: true,
      message: 'Student linked successfully',
      studentCount: parent.studentIds.length
    });

  } catch (error) {
    console.error('❌ Link student error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link student'
    });
  }
};

// NEW: Get user profile with linked students
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('studentIds', 'name studentId class feePaid balance')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
};

module.exports = {
  register,
  login,
  sendOtp,
  verifyOtpAndRegister,
  resendOtp,
  linkStudentToParent,
  getProfile
};
