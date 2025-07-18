const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');
const Otp = require('../models/Otp');

// Initialize Twilio client with error handling
let client;
try {
  if (process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio client initialized successfully');
  } else {
    console.error('Twilio credentials not found in environment variables');
  }
} catch (error) {
  console.error('Error initializing Twilio client:', error);
}

// ✅ Send OTP to phone number
exports.sendOtp = async (req, res) => {
  const { phone } = req.body;
  
  console.log('OTP request received for phone:', phone);
  
  // Validate phone number
  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  // Check if Twilio is configured
  if (!client) {
    console.error('Twilio client not initialized');
    return res.status(500).json({ 
      message: 'SMS service not configured. Please check Twilio credentials.',
      error: 'TWILIO_NOT_CONFIGURED'
    });
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  console.log('Generated OTP:', otpCode);

  try {
    // Check environment variables
    console.log('Twilio config check:', {
      sid: process.env.TWILIO_SID ? 'Present' : 'Missing',
      token: process.env.TWILIO_AUTH_TOKEN ? 'Present' : 'Missing',
      phone: process.env.TWILIO_PHONE ? 'Present' : 'Missing'
    });

    // Send OTP via Twilio
    const message = await client.messages.create({
      body: `Your OTP for School Management is: ${otpCode}. Valid for 5 minutes.`,
      from: process.env.TWILIO_PHONE,
      to: phone
    });

    console.log('OTP sent successfully:', message.sid);

    // Save OTP to DB (valid for 5 minutes)
    await Otp.deleteMany({ phone }); // cleanup old OTPs
    const otpDoc = new Otp({ 
      phone, 
      otp: otpCode, 
      createdAt: new Date() 
    });
    await otpDoc.save();

    console.log('OTP saved to database');

    res.json({ 
      message: 'OTP sent successfully',
      messageSid: message.sid
    });
  } catch (err) {
    console.error('OTP error:', err);
    
    // Handle specific Twilio errors
    if (err.code === 21608) {
      return res.status(400).json({ 
        message: 'Invalid phone number format. Please use international format (+919876543210)',
        error: 'INVALID_PHONE_NUMBER'
      });
    }
    
    if (err.code === 20003) {
      return res.status(403).json({ 
        message: 'Authentication failed. Please check Twilio credentials.',
        error: 'TWILIO_AUTH_FAILED'
      });
    }

    res.status(500).json({ 
      message: 'Failed to send OTP', 
      error: err.message,
      code: err.code || 'UNKNOWN_ERROR'
    });
  }
};

// ✅ Register user with OTP
exports.verifyOtpAndRegister = async (req, res) => {
  const { name, username, password, otp, phone } = req.body;

  console.log('OTP verification request:', { name, username, phone, otp });

  // Validate required fields
  if (!name || !username || !password || !otp || !phone) {
    return res.status(400).json({ 
      message: 'All fields are required: name, username, password, otp, phone' 
    });
  }

  try {
    // Find OTP record
    const existingOtp = await Otp.findOne({ phone });
    console.log('Found OTP record:', existingOtp);

    if (!existingOtp) {
      return res.status(400).json({ message: 'OTP not found. Please request a new OTP.' });
    }

    if (existingOtp.otp !== otp) {
      console.log('OTP mismatch. Expected:', existingOtp.otp, 'Received:', otp);
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { phone }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Username or phone number already exists' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      username,
      phone,
      password: hashedPassword
    });

    const savedUser = await user.save();
    await Otp.deleteMany({ phone }); // clear used OTPs

    console.log('User registered successfully:', savedUser._id);

    // Generate JWT token
    const token = jwt.sign({ userId: savedUser._id }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.status(201).json({ 
      message: 'User registered successfully with OTP',
      token,
      user: {
        _id: savedUser._id,
        name: savedUser.name,
        username: savedUser.username,
        phone: savedUser.phone
      }
    });
  } catch (err) {
    console.error('OTP Registration Error:', err);
    res.status(500).json({ 
      message: 'Server error during OTP registration',
      error: err.message 
    });
  }
};

// ✅ Standard username-password registration (optional)
exports.register = async (req, res) => {
  try {
    const { name, email, username, password, phone } = req.body;

    console.log('Standard registration request:', { name, username, phone });

    // Validate required fields
    if (!name || !username || !password || !phone) {
      return res.status(400).json({ 
        message: 'Name, username, password, and phone are required' 
      });
    }

    const existingUser = await User.findOne({ 
      $or: [{ username }, { phone }]
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Username or phone number already exists' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      username,
      phone,
      password: hashedPassword
    });

    const savedUser = await user.save();
    console.log('User registered successfully:', savedUser._id);

    // Generate JWT token
    const token = jwt.sign({ userId: savedUser._id }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });
    
    res.status(201).json({ 
      message: 'User registered successfully',
      token,
      user: {
        _id: savedUser._id,
        name: savedUser.name,
        username: savedUser.username,
        phone: savedUser.phone
      }
    });
  } catch (err) {
    console.error('Standard registration error:', err);
    res.status(500).json({ 
      message: 'Server error during registration',
      error: err.message 
    });
  }
};

// ✅ Login using username & password
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('Login request for username:', username);

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ 
        message: 'Username and password are required' 
      });
    }

    const user = await User.findOne({ username });
    if (!user) {
      console.log('User not found:', username);
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch for user:', username);
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    console.log('Login successful for user:', username);

    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      message: 'Server error during login',
      error: err.message 
    });
  }
};