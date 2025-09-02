const express = require('express');
const router = express.Router();

// Import middleware
const { auth, adminOnly, parentOnly, adminOrParent } = require('../middleware/auth');

// Import controller functions
const {
  generateUpiQR,
  confirmPayment,
  getPaymentHistory,
  verifyPayment,
  getPaymentStats,
  sendPaymentReminder
} = require('../controllers/paymentController');

// Health check route (no auth required)
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Payment routes are working',
    timestamp: new Date().toISOString()
  });
});

// All payment routes require authentication
router.use(auth);

// UPI QR generation - accessible by both admin and parent
router.post('/generate-qr', adminOrParent, generateUpiQR);

// Payment confirmation - accessible by both admin and parent
router.post('/confirm', adminOrParent, confirmPayment);

// Payment history - role-based access
router.get('/history', adminOrParent, getPaymentHistory);

// Payment verification - admin only
router.post('/verify', adminOnly, verifyPayment);

// Payment statistics - admin only
router.get('/stats', adminOnly, getPaymentStats);

// Send payment reminder - admin only
router.post('/send-reminder', adminOnly, sendPaymentReminder);

// Get specific payment details
router.get('/:paymentId', adminOrParent, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const Payment = require('../models/Payment');

    let query = { _id: paymentId };

    // Parents can only access their own payments
    if (req.user.role === 'parent') {
      query.parentId = req.user._id;
    }

    const payment = await Payment.findOne(query)
      .populate('studentId', 'name studentId class')
      .populate('parentId', 'name phone')
      .populate('verifiedBy', 'name username');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment: payment
    });

  } catch (error) {
    console.error('❌ Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details'
    });
  }
});

module.exports = router;
