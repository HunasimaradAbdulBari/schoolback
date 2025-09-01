const express = require('express');
const router = express.Router();

// Import controller functions
const {
  sendOtp,
  verifyOtpAndRegister,
  register,
  login
} = require('../controllers/authController');

// Validate that all functions are imported correctly
console.log('Auth controller functions check:', {
  sendOtp: typeof sendOtp,
  verifyOtpAndRegister: typeof verifyOtpAndRegister,
  register: typeof register,
  login: typeof login
});

// Health check route for auth
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Auth routes are working',
    timestamp: new Date().toISOString()
  });
});

// OTP routes (disabled but kept for compatibility)
router.post('/send-otp', sendOtp);
router.post('/verify-otp-register', verifyOtpAndRegister);

// Standard auth routes
router.post('/register', register);
router.post('/login', login);

module.exports = router;
