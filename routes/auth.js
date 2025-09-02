const express = require('express');
const router = express.Router();

// Import middleware
const { auth } = require('../middleware/auth');

// Import controller functions
const {
  sendOtp,
  verifyOtpAndRegister,
  register,
  login,
  resendOtp,
  linkStudentToParent,
  getProfile
} = require('../controllers/authController');

// Validate that all functions are imported correctly
console.log('Enhanced auth controller functions check:', {
  sendOtp: typeof sendOtp,
  verifyOtpAndRegister: typeof verifyOtpAndRegister,
  register: typeof register,
  login: typeof login,
  resendOtp: typeof resendOtp,
  linkStudentToParent: typeof linkStudentToParent,
  getProfile: typeof getProfile
});

// Health check route for auth
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Enhanced auth routes are working',
    timestamp: new Date().toISOString(),
    features: ['SMS OTP', 'Role-based Auth', 'Parent Registration']
  });
});

// Public routes (no authentication required)
router.post('/login', login);
router.post('/register', register); // Admin registration
router.post('/send-otp', sendOtp); // Parent registration step 1
router.post('/verify-otp-register', verifyOtpAndRegister); // Parent registration step 2
router.post('/resend-otp', resendOtp); // Resend OTP

// Protected routes (authentication required)
router.use(auth);

// Get user profile with linked students
router.get('/profile', getProfile);

// Link student to parent (admin only, but validation is in controller)
router.post('/link-student', linkStudentToParent);

// Check authentication status
router.get('/verify', (req, res) => {
  res.json({
    success: true,
    user: {
      _id: req.user._id,
      name: req.user.name,
      username: req.user.username,
      role: req.user.role,
      email: req.user.email,
      phone: req.user.phone,
      studentIds: req.user.studentIds || []
    }
  });
});

// Get available SMS carriers
router.get('/carriers', (req, res) => {
  const smsService = require('../services/smsService');
  res.json({
    success: true,
    carriers: Object.keys(smsService.SMS_GATEWAYS).map(key => ({
      value: key,
      label: key.charAt(0).toUpperCase() + key.slice(1)
    }))
  });
});

module.exports = router;
