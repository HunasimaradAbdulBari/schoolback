const express = require('express');
const router = express.Router();

// Import middleware
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// Import controller functions
const {
  createStudent,
  getStudents,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');

// Validate that all functions are imported correctly
console.log('Student controller functions check:', {
  createStudent: typeof createStudent,
  getStudents: typeof getStudents,
  updateStudent: typeof updateStudent,
  deleteStudent: typeof deleteStudent
});

// Health check route (no auth required)
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Student routes are working',
    timestamp: new Date().toISOString()
  });
});

// All other routes require authentication
router.use(auth);

// Student CRUD routes
router.post('/', upload.single('studentPhoto'), createStudent);
router.get('/', getStudents);
router.put('/:id', updateStudent);
router.delete('/:id', deleteStudent);

module.exports = router;
