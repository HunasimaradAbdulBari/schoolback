const express = require('express');
const {
  register,
  login
} = require('../controllers/authController');

const router = express.Router();

// ✅ Clean auth routes - OTP system removed
router.post('/register', register);
router.post('/login', login);

module.exports = router;