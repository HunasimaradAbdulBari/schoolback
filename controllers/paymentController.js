const Payment = require('../models/Payment');
const Student = require('../models/student');
const User = require('../models/User');
const QRCode = require('qrcode');
const smsService = require('../services/smsService');

// Generate UPI QR Code
const generateUpiQR = async (req, res) => {
  try {
    const { studentId, amount, purpose = 'School Fee Payment' } = req.body;

    // Validate input
    if (!studentId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and amount are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Get student details
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if user has permission to pay for this student
    if (req.user.role === 'parent' && !req.user.studentIds.includes(studentId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only make payments for your own children'
      });
    }

    // Create UPI payment URL
    const upiId = process.env.SCHOOL_UPI_ID || 'astraschool@paytm';
    const schoolName = 'Astra Preschool';
    const note = `${purpose} - ${student.name} (${student.studentId || 'ID: ' + student._id.toString().slice(-6)})`;
    
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(schoolName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

    // Generate QR code
    const qrImage = await QRCode.toDataURL(upiUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Create pending payment record
    const payment = new Payment({
      studentId: studentId,
      parentId: req.user._id,
      amount: amount,
      purpose: purpose,
      status: 'pending',
      method: 'upi'
    });

    await payment.save();

    console.log('✅ UPI QR generated for student:', student.name, 'Amount:', amount);

    res.json({
      success: true,
      qrImage: qrImage,
      upiUrl: upiUrl,
      paymentId: payment._id,
      receiptNumber: payment.receiptNumber,
      studentName: student.name,
      amount: amount,
      upiId: upiId
    });

  } catch (error) {
    console.error('❌ Generate UPI QR error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate payment QR code'
    });
  }
};

// Confirm payment by parent
const confirmPayment = async (req, res) => {
  try {
    const { paymentId, upiTransactionId } = req.body;

    const payment = await Payment.findById(paymentId)
      .populate('studentId', 'name studentId class')
      .populate('parentId', 'name phone carrier');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    // Check if user has permission
    if (req.user.role === 'parent' && payment.parentId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only confirm your own payments'
      });
    }

    // Update payment with confirmation details
    payment.confirmedByParent = true;
    payment.confirmedAt = new Date();
    payment.upiTransactionId = upiTransactionId || `UPI${Date.now()}`;
    payment.status = 'completed'; // Auto-complete for now, admin can verify later

    await payment.save();

    // Update student fee records
    const student = await Student.findById(payment.studentId);
    if (student) {
      student.feePaid = (student.feePaid || 0) + payment.amount;
      student.balance = Math.max(0, (student.balance || 0) - payment.amount);
      await student.save();
    }

    // Send payment confirmation SMS
    if (payment.parentId.phone && payment.parentId.carrier) {
      await smsService.sendPaymentConfirmationSMS(
        payment.parentId.phone,
        payment.parentId.carrier,
        {
          studentName: payment.studentId.name,
          amount: payment.amount,
          receiptNumber: payment.receiptNumber
        }
      );
    }

    console.log('✅ Payment confirmed:', payment.receiptNumber);

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      payment: payment,
      receiptNumber: payment.receiptNumber
    });

  } catch (error) {
    console.error('❌ Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment'
    });
  }
};

// Get payment history
const getPaymentHistory = async (req, res) => {
  try {
    let query = {};

    // Filter based on user role
    if (req.user.role === 'parent') {
      query.parentId = req.user._id;
    }

    // Add optional filters
    const { studentId, status, startDate, endDate } = req.query;
    
    if (studentId) query.studentId = studentId;
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(query)
      .populate('studentId', 'name studentId class')
      .populate('parentId', 'name phone')
      .populate('verifiedBy', 'name username')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments: payments,
      total: payments.length
    });

  } catch (error) {
    console.error('❌ Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
};

// Admin verify payment
const verifyPayment = async (req, res) => {
  try {
    const { paymentId, verified } = req.body;

    // Only admins can verify payments
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can verify payments'
      });
    }

    const payment = await Payment.findById(paymentId)
      .populate('studentId', 'name studentId')
      .populate('parentId', 'name phone carrier');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    payment.status = verified ? 'completed' : 'failed';
    payment.verifiedBy = req.user._id;
    payment.verifiedAt = new Date();

    await payment.save();

    // If payment is rejected, revert student balance
    if (!verified) {
      const student = await Student.findById(payment.studentId);
      if (student) {
        student.feePaid = Math.max(0, (student.feePaid || 0) - payment.amount);
        student.balance = (student.balance || 0) + payment.amount;
        await student.save();
      }
    }

    console.log('✅ Payment verification updated:', payment.receiptNumber, 'Status:', payment.status);

    res.json({
      success: true,
      message: `Payment ${verified ? 'verified' : 'rejected'} successfully`,
      payment: payment
    });

  } catch (error) {
    console.error('❌ Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment'
    });
  }
};

// Get payment statistics (admin only)
const getPaymentStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const stats = await Payment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const monthlyStats = await Payment.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          completedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      stats: stats,
      monthlyStats: monthlyStats[0] || { totalPayments: 0, totalAmount: 0, completedPayments: 0 }
    });

  } catch (error) {
    console.error('❌ Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statistics'
    });
  }
};

// Send payment reminder SMS
const sendPaymentReminder = async (req, res) => {
  try {
    const { studentId, message } = req.body;

    // Only admins can send reminders
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can send payment reminders'
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Find parent user
    const parent = await User.findOne({ 
      phone: student.parentPhone,
      role: 'parent'
    });

    if (!parent || !parent.phone || !parent.carrier) {
      return res.status(404).json({
        success: false,
        message: 'Parent contact information not found'
      });
    }

    // Send reminder SMS
    const reminderMessage = message || `Fee Reminder: ₹${student.balance} pending for ${student.name}. Please pay at your earliest. - Astra Preschool`;
    
    const result = await smsService.sendSMS(parent.phone, parent.carrier, reminderMessage);

    if (result.success) {
      res.json({
        success: true,
        message: 'Payment reminder sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send payment reminder'
      });
    }

  } catch (error) {
    console.error('❌ Send payment reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send payment reminder'
    });
  }
};

module.exports = {
  generateUpiQR,
  confirmPayment,
  getPaymentHistory,
  verifyPayment,
  getPaymentStats,
  sendPaymentReminder
};
