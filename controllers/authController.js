const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');
const Otp = require('../models/Otp');

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// ✅ Send OTP to phone number
exports.sendOtp = async (req, res) => {
  const { phone } = req.body;
  
  // Validate phone number
  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Send OTP via Twilio
    const message = await client.messages.create({
      body: `Your OTP is ${otpCode}`,
      from: process.env.TWILIO_PHONE,
      to: phone
    });

    console.log('OTP sent successfully:', message.sid);

    // Save OTP to DB (valid for 5 minutes)
    await Otp.deleteMany({ phone }); // cleanup old OTPs
    await new Otp({ phone, otp: otpCode, createdAt: Date.now() }).save();

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('OTP error:', err);
    res.status(500).json({ 
      message: 'Failed to send OTP', 
      error: err.message 
    });
  }
};

// ✅ Register user with OTP
exports.verifyOtpAndRegister = async (req, res) => {
  const { name, username, password, otp, phone } = req.body;

  // Validate required fields
  if (!name || !username || !password || !otp || !phone) {
    return res.status(400).json({ 
      message: 'All fields are required: name, username, password, otp, phone' 
    });
  }

  try {
    const existingOtp = await Otp.findOne({ phone });

    if (!existingOtp || existingOtp.otp !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
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

    await user.save();
    await Otp.deleteMany({ phone }); // clear used OTPs

    res.status(201).json({ 
      message: 'User registered successfully with OTP',
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone
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

    await user.save();
    
    res.status(201).json({ 
      message: 'User registered successfully',
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone
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

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ 
        message: 'Username and password are required' 
      });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({
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