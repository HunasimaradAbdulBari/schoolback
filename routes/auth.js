const express = require('express');
const {
  sendOtp,
  verifyOtpAndRegister,
  register,
  login
} = require('../controllers/authController');

const router = express.Router();

// OTP routes
router.post('/send-otp', sendOtp);
router.post('/verify-otp-register', verifyOtpAndRegister);

// Standard auth routes
router.post('/register', register);
router.post('/login', login);

module.exports = router;