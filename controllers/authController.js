const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ✅ FIXED: Simple registration without OTP - works with email OR without email
exports.register = async (req, res) => {
  try {
    console.log('🔍 Registration attempt:', req.body);
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
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ 
          success: false,
          message: 'Email already registered' 
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userData = {
      name,
      username,
      password: hashedPassword
    };

    // Only add email if provided
    if (email && email.trim()) {
      userData.email = email.trim();
    }

    const user = new User(userData);
    await user.save();

    console.log('✅ User registered successfully:', user.username);

    // ✅ FIXED: Consistent response format
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email || null
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

    res.status(500).json({ 
      success: false,
      message: 'Server error during registration' 
    });
  }
};

// ✅ FIXED: Login using username & password - enhanced error handling
exports.login = async (req, res) => {
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

    // Find user by username OR email
    const user = await User.findOne({
      $or: [
        { username: username },
        { email: username }
      ]
    });

    if (!user) {
      console.log('❌ User not found:', username);
      return res.status(400).json({ 
        success: false,
        message: 'Invalid username or password' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('❌ Password mismatch for user:', username);
      return res.status(400).json({ 
        success: false,
        message: 'Invalid username or password' 
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful for user:', user.username);

    // ✅ FIXED: Consistent response format matching frontend expectations
    const response = {
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username
      }
    };

    // Add email to response only if it exists
    if (user.email) {
      response.user.email = user.email;
    }

    res.json(response);

  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login' 
    });
  }
};
