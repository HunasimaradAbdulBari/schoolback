const User = require('../models/User');
const Student = require('../models/student');
const Otp = require('../models/Otp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Enhanced SMS service with better error handling
const smsService = {
  SMS_GATEWAYS: {
    verizon: "vtext.com",
    att: "txt.att.net", 
    tmobile: "tmomail.net",
    sprint: "messaging.sprintpcs.com",
    airtel: "airtelmail.com",
    jio: "jiomail.com",
    vodafone: "vodafonemail.com"
  },

  createTransporter: () => {
    console.log('🔧 Creating email transporter...');
    console.log('📧 Email User:', process.env.EMAIL_USER);
    console.log('🔑 Email Pass Length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);
    
    return nodemailer.createTransporter({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  },

  validatePhoneNumber: (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (/^[6-9]\d{9}$/.test(cleaned)) {
      return { isValid: true, cleanedNumber: cleaned, format: 'indian' };
    }
    return { isValid: false, error: 'Invalid phone number format' };
  },

  detectCarrier: (phoneNumber) => {
    const firstDigit = phoneNumber.charAt(0);
    if (['6', '7', '8', '9'].includes(firstDigit)) {
      return 'airtel';
    }
    return 'tmobile';
  },

  generateOTP: () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  sendSMS: async (phoneNumber, carrier, message) => {
    try {
      console.log(`📤 Sending SMS to ${phoneNumber} via ${carrier}`);
      
      const gateway = smsService.SMS_GATEWAYS[carrier];
      if (!gateway) {
        throw new Error(`Unsupported carrier: ${carrier}`);
      }

      const transporter = smsService.createTransporter();
      
      // Test connection first
      await transporter.verify();
      console.log('✅ Email transporter verified successfully');
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: `${phoneNumber}@${gateway}`,
        subject: "",
        text: message,
      };

      console.log('📧 Sending to:', `${phoneNumber}@${gateway}`);
      const result = await transporter.sendMail(mailOptions);
      
      console.log('✅ SMS sent successfully:', result.messageId);
      return {
        success: true,
        messageId: result.messageId,
        message: "SMS sent successfully"
      };
    } catch (error) {
      console.error('❌ SMS send error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  sendOTPSMS: async (phoneNumber, carrier) => {
    try {
      const otp = smsService.generateOTP();
      const message = `Your Astra Preschool verification code is: ${otp}. This code will expire in 5 minutes. Do not share this code with anyone.`;
      
      console.log('🔢 Generated OTP:', otp);
      const result = await smsService.sendSMS(phoneNumber, carrier, message);
      
      if (result.success) {
        return {
          success: true,
          otp: otp,
          message: "OTP sent successfully"
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ OTP SMS error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  sendWelcomeSMS: async (phoneNumber, carrier, studentNames) => {
    try {
      const message = `Welcome to Astra Preschool! ${studentNames} registered successfully. You can now login to view details and make payments. Thank you!`;
      return await smsService.sendSMS(phoneNumber, carrier, message);
    } catch (error) {
      console.error('❌ Welcome SMS error:', error);
      return { success: false, error: error.message };
    }
  },

  sendPaymentConfirmationSMS: async (phoneNumber, carrier, paymentDetails) => {
    try {
      const { studentName, amount, receiptNumber } = paymentDetails;
      const message = `Payment Confirmed! ₹${amount} received for ${studentName}. Receipt: ${receiptNumber}. Thank you! - Astra Preschool`;
      return await smsService.sendSMS(phoneNumber, carrier, message);
    } catch (error) {
      console.error('❌ Payment confirmation SMS error:', error);
      return { success: false, error: error.message };
    }
  }
};

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

// Enhanced Send OTP with better debugging
const sendOtp = async (req, res) => {
  try {
    console.log('🔍 OTP Request received:', req.body);
    console.log('📧 Environment check:', {
      emailUser: process.env.EMAIL_USER,
      emailPassConfigured: !!process.env.EMAIL_PASS,
      emailPassLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0
    });

    const { phone, carrier } = req.body;

    // Validate phone number
    const phoneValidation = smsService.validatePhoneNumber(phone);
    console.log('📱 Phone validation result:', phoneValidation);
    
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
    console.log('📡 Using carrier:', selectedCarrier);

    // Send OTP via SMS
    console.log('📤 Attempting to send OTP SMS...');
    const otpResult = await smsService.sendOTPSMS(cleanedPhone, selectedCarrier);
    console.log('📤 OTP SMS result:', {
      success: otpResult.success,
      error: otpResult.error || 'None',
      otp: otpResult.otp || 'Not generated'
    });
    
    if (!otpResult.success) {
      console.log('❌ OTP sending failed:', otpResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP: ' + otpResult.error,
        debug: {
          emailConfigured: !!process.env.EMAIL_USER,
          carrier: selectedCarrier,
          phone: cleanedPhone
        }
      });
    }

    // Store OTP in database
    await Otp.deleteMany({ phone: cleanedPhone });
    const otpDoc = new Otp({
      phone: cleanedPhone,
      otp: otpResult.otp
    });
    await otpDoc.save();

    console.log('✅ OTP sent and stored successfully:', {
      phone: cleanedPhone,
      otp: otpResult.otp,
      carrier: selectedCarrier
    });

    res.json({
      success: true,
      message: 'OTP sent successfully to your phone number',
      phone: cleanedPhone,
      debug: {
        carrier: selectedCarrier,
        emailGateway: `${cleanedPhone}@${smsService.SMS_GATEWAYS[selectedCarrier]}`,
        // Remove this in production:
        testOtp: otpResult.otp
      }
    });

  } catch (error) {
    console.error('❌ Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.',
      error: error.message
    });
  }
};

// Verify OTP and register parent
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

    // Send welcome SMS if students found
    if (matchingStudents.length > 0) {
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

// Resend OTP
const resendOtp = async (req, res) => {
  try {
    const { phone, carrier } = req.body;

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
      message: 'OTP resent successfully',
      debug: {
        testOtp: otpResult.otp // Remove in production
      }
    });

  } catch (error) {
    console.error('❌ Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP'
    });
  }
};

// Link additional students to parent account
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

// Get user profile with linked students
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

// Test email configuration (temporary)
const testEmailConfig = async (req, res) => {
  try {
    console.log('🧪 Testing email configuration...');
    console.log('📧 EMAIL_USER:', process.env.EMAIL_USER);
    console.log('🔑 EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 'NOT SET');
    
    const transporter = smsService.createTransporter();
    await transporter.verify();
    
    res.json({
      success: true,
      message: 'Email configuration is working perfectly!',
      config: {
        emailUser: process.env.EMAIL_USER,
        passLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0
      }
    });
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: {
        code: error.code,
        response: error.response
      }
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
  getProfile,
  testEmailConfig // Remove this in production
};
