const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');
const Otp = require('../models/Otp');

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// ✅ Send OTP to phone number
exports.sendOtp = async (req, res) => {
  const { phone } = req.body;
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Send OTP via Twilio
    await client.messages.create({
      body: `Your OTP is ${otpCode}`,
      from: process.env.TWILIO_PHONE,
      to: phone
    });

    // Save OTP to DB (valid for 5 minutes)
    await Otp.deleteMany({ phone }); // cleanup old OTPs
    await new Otp({ phone, otp: otpCode, createdAt: Date.now() }).save();

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('OTP error:', err.message);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

// ✅ Register user with OTP
exports.verifyOtpAndRegister = async (req, res) => {
  const { name, username, password, otp, phone } = req.body;

  try {
    const existingOtp = await Otp.findOne({ phone });

    if (!existingOtp || existingOtp.otp !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
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

    res.status(201).json({ message: 'User registered successfully with OTP' });
  } catch (err) {
    console.error('OTP Registration Error:', err);
    res.status(500).json({ message: 'Server error during OTP registration' });
  }
};

// ✅ Standard username-password registration (optional)
exports.register = async (req, res) => {
  try {
    const { name, email, username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      username,
      password: hashedPassword
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Standard registration error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// ✅ Login using username & password
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
