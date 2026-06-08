const express = require('express');
const {
  register,
  login
} = require('../controllers/authController');

const router = express.Router();

// ✅ Clean auth routes - OTP system completely removed
router.post('/register', register);
router.post('/login', login);

// ✅ NEW: Test endpoint for checking if API is reachable
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Auth API is working', 
    timestamp: new Date().toISOString() 
  });
});

module.exports = router;