const express = require('express');
const router = express.Router();
const { register, login, sendOtp, verifyOtpAndRegister } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtpAndRegister);

module.exports = router;
