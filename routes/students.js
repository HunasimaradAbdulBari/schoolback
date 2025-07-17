const express = require('express');
const {
  createStudent,
  getStudents,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');
const auth = require('../middleware/auth');

const router = express.Router();
const upload = require('../middleware/upload');

router.post('/', auth, upload.single('studentPhoto'), createStudent);


router.use(auth); // All routes require authentication

router.post('/', createStudent);
router.get('/', getStudents);
router.put('/:id', updateStudent);
router.delete('/:id', deleteStudent);

module.exports = router;