const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ✅ Simple registration - works with email OR without email
exports.register = async (req, res) => {
  try {
    console.log('🔍 Registration attempt:', req.body);
    const { name, email, username, password } = req.body;

    // Basic validation
    if (!name || !username || !password) {
      return res.status(400).json({ 
        message: 'Name, username, and password are required' 
      });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Check if email exists (only if email is provided)
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already registered' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      name,
      username,
      password: hashedPassword
    };

    // Only add email if provided
    if (email) {
      userData.email = email;
    }

    const user = new User(userData);
    await user.save();
    
    console.log('✅ User registered successfully:', user.username);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// ✅ Login using username & password - FRONTEND COMPATIBLE
exports.login = async (req, res) => {
  try {
    console.log('🔍 Login attempt:', { username: req.body.username });
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
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
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('❌ Password mismatch for user:', username);
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    console.log('✅ Login successful for user:', user.username);

    // ✅ FRONTEND-COMPATIBLE RESPONSE FORMAT
    const response = {
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
    res.status(500).json({ message: 'Server error during login' });
  }
};