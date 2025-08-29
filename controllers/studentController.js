const Student = require('../models/student');

const createStudent = async (req, res) => {
  try {
    const {
      studentId, // 🆕 NEW: Student ID field
      name, class: studentClass, feePaid, balance, date,
      parentName, parentPhone, address, dateOfBirth,
      bloodGroup, allergies
    } = req.body;

    // 🆕 NEW: Validate Student ID format
    if (!studentId || !studentId.startsWith('AS') || studentId.length !== 6) {
      return res.status(400).json({ 
        message: 'Student ID must be in format AS followed by 4 characters (e.g., AS1234)' 
      });
    }

    // 🆕 NEW: Check if Student ID already exists
    const existingStudent = await Student.findOne({ studentId: studentId.toUpperCase() });
    if (existingStudent) {
      return res.status(400).json({ 
        message: `Student ID ${studentId.toUpperCase()} already exists. Please use a different Student ID.` 
      });
    }

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const student = new Student({
      studentId: studentId.toUpperCase(), // 🆕 NEW: Store Student ID in uppercase
      name, 
      class: studentClass, 
      feePaid, 
      balance, 
      date: date || new Date(),
      parentName, 
      parentPhone, 
      address, 
      dateOfBirth,
      bloodGroup, 
      allergies, 
      createdBy: req.user._id,
      studentPhoto: photoUrl
    });

    const saved = await student.save();
    console.log('✅ Student created successfully with ID:', saved.studentId);
    res.status(201).json(saved);
  } catch (err) {
    console.error('❌ Error creating student:', err);
    
    // Handle duplicate Student ID error
    if (err.code === 11000 && err.keyPattern?.studentId) {
      return res.status(400).json({ 
        message: 'Student ID already exists. Please use a different Student ID.' 
      });
    }
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const firstError = Object.values(err.errors)[0];
      return res.status(400).json({ 
        message: firstError.message 
      });
    }
    
    res.status(500).json({ message: err.message });
  }
};

const getStudents = async (req, res) => {
  try {
    console.log('Fetching students for user:', req.user._id);
    const { search } = req.query;
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } } // 🆕 NEW: Search by Student ID too
      ];
    }

    const students = await Student.find(query)
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${students.length} students`);
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ 
      message: 'Server error while fetching students', 
      error: error.message 
    });
  }
};

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 🆕 NEW: If updating Student ID, validate format and uniqueness
    if (updates.studentId) {
      if (!updates.studentId.startsWith('AS') || updates.studentId.length !== 6) {
        return res.status(400).json({ 
          message: 'Student ID must be in format AS followed by 4 characters (e.g., AS1234)' 
        });
      }
      
      // Check if new Student ID already exists (excluding current student)
      const existingStudent = await Student.findOne({ 
        studentId: updates.studentId.toUpperCase(),
        _id: { $ne: id }
      });
      
      if (existingStudent) {
        return res.status(400).json({ 
          message: `Student ID ${updates.studentId.toUpperCase()} already exists. Please use a different Student ID.` 
        });
      }
      
      updates.studentId = updates.studentId.toUpperCase();
    }

    console.log('Updating student:', id, 'with data:', updates);

    const student = await Student.findByIdAndUpdate(id, updates, { 
      new: true,
      runValidators: true 
    });
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    console.log('Student updated successfully:', student);
    res.json(student);
  } catch (error) {
    console.error('Error updating student:', error);
    
    // Handle duplicate Student ID error
    if (error.code === 11000 && error.keyPattern?.studentId) {
      return res.status(400).json({ 
        message: 'Student ID already exists. Please use a different Student ID.' 
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0];
      return res.status(400).json({ 
        message: firstError.message 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error while updating student', 
      error: error.message 
    });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Deleting student:', id);

    const student = await Student.findByIdAndDelete(id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    console.log('Student deleted successfully:', student.name, '(ID:', student.studentId, ')');
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ 
      message: 'Server error while deleting student', 
      error: error.message 
    });
  }
};

module.exports = {
  createStudent,
  getStudents,
  updateStudent,
  deleteStudent,
};