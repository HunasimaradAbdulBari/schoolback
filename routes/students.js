const express = require('express');
const router = express.Router();

// Import middleware
const { auth, adminOnly, parentOnly, adminOrParent, checkStudentAccess } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Import controller functions
const {
  createStudent,
  getStudents,
  updateStudent,
  deleteStudent,
  getStudentDetails,
  getStudentsByParentPhone,
  linkStudentToParent
} = require('../controllers/studentController');

// Validate that all functions are imported correctly
console.log('Enhanced student controller functions check:', {
  createStudent: typeof createStudent,
  getStudents: typeof getStudents,
  updateStudent: typeof updateStudent,
  deleteStudent: typeof deleteStudent,
  getStudentDetails: typeof getStudentDetails,
  getStudentsByParentPhone: typeof getStudentsByParentPhone,
  linkStudentToParent: typeof linkStudentToParent
});

// Health check route (no auth required)
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Enhanced student routes are working',
    timestamp: new Date().toISOString(),
    features: ['Role-based Access', 'Parent Linking', 'Student Management']
  });
});

// All other routes require authentication
router.use(auth);

// Student CRUD routes with role-based access
router.post('/', adminOnly, upload.single('studentPhoto'), createStudent); // Only admins can create
router.get('/', adminOrParent, getStudents); // Both can view (filtered by role)
router.get('/:id', adminOrParent, checkStudentAccess, getStudentDetails); // Role-based access
router.put('/:id', adminOrParent, checkStudentAccess, updateStudent); // Role-based updates
router.delete('/:id', adminOnly, deleteStudent); // Only admins can delete

// Admin-only routes
router.get('/by-phone/:phone', adminOnly, getStudentsByParentPhone); // Search students by parent phone
router.post('/link-to-parent', adminOnly, linkStudentToParent); // Manual linking

// Bulk operations (admin only)
router.post('/bulk-link', adminOnly, async (req, res) => {
  try {
    const { parentPhone, studentIds } = req.body;

    if (!parentPhone || !studentIds || !Array.isArray(studentIds)) {
      return res.status(400).json({
        success: false,
        message: 'Parent phone and student IDs array are required'
      });
    }

    const smsService = require('../services/smsService');
    const phoneValidation = smsService.validatePhoneNumber(parentPhone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    const cleanedPhone = phoneValidation.cleanedNumber;

    // Find parent
    const parent = await User.findOne({ 
      phone: cleanedPhone,
      role: 'parent'
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent account not found'
      });
    }

    // Get students
    const Student = require('../models/student');
    const students = await Student.find({ _id: { $in: studentIds } });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more students not found'
      });
    }

    // Add students to parent account (avoid duplicates)
    const newStudentIds = studentIds.filter(id => !parent.studentIds.includes(id));
    parent.studentIds.push(...newStudentIds);
    await parent.save();

    // Update students' parent phone
    await Student.updateMany(
      { _id: { $in: studentIds } },
      { parentPhone: cleanedPhone }
    );

    res.json({
      success: true,
      message: `${newStudentIds.length} students linked successfully`,
      totalLinked: parent.studentIds.length
    });

  } catch (error) {
    console.error('❌ Bulk link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link students'
    });
  }
});

// Get student fee summary (parent-specific)
router.get('/:id/fee-summary', parentOnly, checkStudentAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const Student = require('../models/student');
    const Payment = require('../models/Payment');

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get payment history for this student
    const payments = await Payment.find({ 
      studentId: id,
      status: 'completed'
    }).sort({ createdAt: -1 });

    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const lastPayment = payments.length > 0 ? payments[0] : null;

    res.json({
      success: true,
      student: {
        _id: student._id,
        name: student.name,
        studentId: student.studentId,
        class: student.class,
        feePaid: student.feePaid,
        balance: student.balance
      },
      paymentSummary: {
        totalPaid: totalPaid,
        pendingBalance: student.balance,
        lastPaymentDate: lastPayment ? lastPayment.createdAt : null,
        lastPaymentAmount: lastPayment ? lastPayment.amount : 0,
        totalPayments: payments.length
      },
      recentPayments: payments.slice(0, 5) // Last 5 payments
    });

  } catch (error) {
    console.error('❌ Get fee summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee summary'
    });
  }
});

module.exports = router;
