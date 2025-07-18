const express = require('express');
const router = express.Router();
const {
  sendOtp,
  verifyOtpAndRegister,
  register,
  login
} = require('../controllers/authController');

// Route definitions
router.post('/send-otp', sendOtp);
router.post('/verify-otp-register', verifyOtpAndRegister);
router.post('/register', register);
router.post('/login', login);

module.exports = router;