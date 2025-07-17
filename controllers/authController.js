const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ✅ OTP Setup
const twilio = require('twilio');
const Otp = require('../models/Otp');

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// ✅ Standard Registration (username/password)
exports.register = async (req, res) => {
  try {
    const { name, username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      username,
      password: hashedPassword
    });

    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// ✅ Standard Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Invalid username or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid username or password' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// ✅ Send OTP (Twilio)
exports.sendOtp = async (req, res) => {
  const { phone } = req.body;
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await client.messages.create({
      body: `Your OTP is ${otpCode}`,
      from: process.env.TWILIO_PHONE,
      to: phone
    });

    await Otp.deleteMany({ phone }); // Remove any existing OTPs
    await new Otp({ phone, otp: otpCode }).save();

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('OTP error:', err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

// ✅ Verify OTP and Register User
exports.verifyOtpAndRegister = async (req, res) => {
  const { name, phone, username, otp, password } = req.body;

  try {
    const existingOtp = await Otp.findOne({ phone });

    if (!existingOtp || existingOtp.otp !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const user = new User({ name, username, phone, password: hashedPassword });
    await user.save();

    await Otp.deleteMany({ phone }); // Clean up used OTP

    res.status(201).json({ message: 'User registered successfully with OTP' });
  } catch (err) {
    console.error('OTP Registration Error:', err);
    res.status(500).json({ message: 'Server error during OTP verification' });
  }
};
