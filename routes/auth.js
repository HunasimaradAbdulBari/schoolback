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
  try {
    // Import SMS service with fallback
    let SMS_GATEWAYS = {};
    try {
      const smsService = require('../services/smsService');
      SMS_GATEWAYS = smsService.SMS_GATEWAYS || {};
    } catch (error) {
      console.warn('SMS service not available, using default carriers');
    }
    
    // Default carriers if SMS service not available
    const defaultCarriers = {
      airtel: 'airtelmail.com',
      jio: 'jiomail.com', 
      vodafone: 'vodafonemail.com',
      tmobile: 'tmomail.net',
      verizon: 'vtext.com',
      att: 'txt.att.net',
      sprint: 'messaging.sprintpcs.com'
    };
    
    const carriersToUse = Object.keys(SMS_GATEWAYS).length > 0 ? SMS_GATEWAYS : defaultCarriers;
    
    res.json({
      success: true,
      carriers: Object.keys(carriersToUse).map(key => ({
        value: key,
        label: key.charAt(0).toUpperCase() + key.slice(1)
      }))
    });
  } catch (error) {
    console.error('Error fetching carriers:', error);
    // Return basic carriers as fallback
    res.json({
      success: true,
      carriers: [
        { value: 'airtel', label: 'Airtel' },
        { value: 'jio', label: 'Jio' },
        { value: 'vodafone', label: 'Vodafone' },
        { value: 'tmobile', label: 'T-Mobile' },
        { value: 'verizon', label: 'Verizon' },
        { value: 'att', label: 'AT&T' },
        { value: 'sprint', label: 'Sprint' }
      ]
    });
  }
});

module.exports = router;
