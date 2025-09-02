const Student = require('../models/student');
const User = require('../models/User');
const smsService = require('../services/smsService');

const createStudent = async (req, res) => {
  try {
    const {
      studentId, // Student ID field
      name, class: studentClass, feePaid, balance, date,
      parentName, parentPhone, address, dateOfBirth,
      bloodGroup, allergies
    } = req.body;

    // Validate Student ID format
    if (!studentId || !studentId.startsWith('AS') || studentId.length !== 6) {
      return res.status(400).json({ 
        message: 'Student ID must be in format AS followed by 4 characters (e.g., AS1234)' 
      });
    }

    // Check if Student ID already exists
    const existingStudent = await Student.findOne({ studentId: studentId.toUpperCase() });
    if (existingStudent) {
      return res.status(400).json({ 
        message: `Student ID ${studentId.toUpperCase()} already exists. Please use a different Student ID.` 
      });
    }

    // Validate phone number if provided
    if (parentPhone) {
      const phoneValidation = smsService.validatePhoneNumber(parentPhone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    const cleanedPhone = phoneValidation.cleanedNumber;

    // Find parent user
    const parent = await User.findOne({ 
      phone: cleanedPhone,
      role: 'parent'
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent account not found with this phone number'
      });
    }

    // Check if already linked
    if (parent.studentIds.includes(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Student already linked to this parent'
      });
    }

    // Add student to parent's account
    parent.studentIds.push(studentId);
    await parent.save();

    // Update student's parent phone if different
    if (student.parentPhone !== cleanedPhone) {
      student.parentPhone = cleanedPhone;
      await student.save();
    }

    res.json({
      success: true,
      message: 'Student linked to parent successfully',
      parentName: parent.name,
      studentName: student.name
    });

  } catch (error) {
    console.error('❌ Link student to parent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link student to parent'
    });
  }
};

module.exports = {
  createStudent,
  getStudents,
  updateStudent,
  deleteStudent,
  getStudentDetails,
  getStudentsByParentPhone,
  linkStudentToParent
};
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          message: 'Invalid parent phone number format'
        });
      }
    }

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const student = new Student({
      studentId: studentId.toUpperCase(),
      name, 
      class: studentClass, 
      feePaid, 
      balance, 
      date: date || new Date(),
      parentName, 
      parentPhone: parentPhone ? smsService.validatePhoneNumber(parentPhone).cleanedNumber : null, 
      address, 
      dateOfBirth,
      bloodGroup, 
      allergies, 
      createdBy: req.user._id,
      studentPhoto: photoUrl
    });

    const savedStudent = await student.save();

    // Auto-link to existing parent account if phone matches
    if (savedStudent.parentPhone) {
      const parentUser = await User.findOne({ 
        phone: savedStudent.parentPhone,
        role: 'parent'
      });

      if (parentUser) {
        // Add student to parent's studentIds if not already linked
        if (!parentUser.studentIds.includes(savedStudent._id)) {
          parentUser.studentIds.push(savedStudent._id);
          await parentUser.save();
          console.log('✅ Student auto-linked to existing parent account:', parentUser.name);
        }
      }
    }

    console.log('✅ Student created successfully with ID:', savedStudent.studentId);
    res.status(201).json(savedStudent);
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
    console.log('Fetching students for user:', req.user._id, 'Role:', req.user.role);
    const { search } = req.query;
    let query = {};
    
    // Role-based filtering
    if (req.user.role === 'parent') {
      // Parents can only see their own students
      query._id = { $in: req.user.studentIds };
    }
    
    // Add search filter if provided
    if (search) {
      const searchQuery = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { studentId: { $regex: search, $options: 'i' } }
        ]
      };
      
      if (query._id) {
        // Combine role filter with search filter for parents
        query = { $and: [{ _id: query._id }, searchQuery] };
      } else {
        // Just search filter for admins
        query = searchQuery;
      }
    }

    const students = await Student.find(query)
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${students.length} students for ${req.user.role}:`, req.user.name);
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

    // Check if parent is trying to update student they don't own
    if (req.user.role === 'parent') {
      const hasAccess = req.user.studentIds.some(
        studentId => studentId.toString() === id.toString()
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          message: 'You can only update your own children\'s records'
        });
      }

      // Parents can only update specific fields
      const allowedFields = ['address', 'allergies', 'parentName'];
      const updateKeys = Object.keys(updates);
      const unauthorizedFields = updateKeys.filter(key => !allowedFields.includes(key));
      
      if (unauthorizedFields.length > 0) {
        return res.status(403).json({
          message: `Parents cannot update: ${unauthorizedFields.join(', ')}`
        });
      }
    }

    // If updating Student ID, validate format and uniqueness (admin only)
    if (updates.studentId && req.user.role === 'admin') {
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

    // Validate phone number if being updated (admin only)
    if (updates.parentPhone && req.user.role === 'admin') {
      const phoneValidation = smsService.validatePhoneNumber(updates.parentPhone);
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          message: 'Invalid parent phone number format'
        });
      }
      updates.parentPhone = phoneValidation.cleanedNumber;
    }

    console.log('Updating student:', id, 'with data:', updates);

    const student = await Student.findByIdAndUpdate(id, updates, { 
      new: true,
      runValidators: true 
    });
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // If phone number was updated by admin, update parent linking
    if (updates.parentPhone && req.user.role === 'admin') {
      // Remove student from old parent accounts
      await User.updateMany(
        { role: 'parent', studentIds: student._id },
        { $pull: { studentIds: student._id } }
      );

      // Link to new parent account if exists
      const newParent = await User.findOne({ 
        phone: updates.parentPhone,
        role: 'parent'
      });

      if (newParent && !newParent.studentIds.includes(student._id)) {
        newParent.studentIds.push(student._id);
        await newParent.save();
        console.log('✅ Student re-linked to parent:', newParent.name);
      }
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

    // Only admins can delete students
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Only administrators can delete students'
      });
    }

    console.log('Deleting student:', id);

    const student = await Student.findByIdAndDelete(id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Remove student from all parent accounts
    await User.updateMany(
      { role: 'parent', studentIds: id },
      { $pull: { studentIds: id } }
    );

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

// NEW: Get student details for parent dashboard
const getStudentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Check access permissions
    if (req.user.role === 'parent') {
      const hasAccess = req.user.studentIds.some(
        studentId => studentId.toString() === id.toString()
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          message: 'You can only access your own children\'s records'
        });
      }
    }

    const student = await Student.findById(id)
      .populate('createdBy', 'username name');

    if (!student) {
      return res.status(404).json({
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      student: student
    });

  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({
      message: 'Failed to fetch student details'
    });
  }
};

// NEW: Get students by parent phone (for linking during registration)
const getStudentsByParentPhone = async (req, res) => {
  try {
    const { phone } = req.params;

    // Only admins can search by phone
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const phoneValidation = smsService.validatePhoneNumber(phone);
    if (!phoneValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    const students = await Student.find({ 
      parentPhone: phoneValidation.cleanedNumber 
    }).select('name studentId class feePaid balance');

    res.json({
      success: true,
      students: students,
      count: students.length
    });

  } catch (error) {
    console.error('Error fetching students by phone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students'
    });
  }
};

// NEW: Manual link student to parent (admin only)
const linkStudentToParent = async (req, res) => {
  try {
    const { studentId, parentPhone } = req.body;

    // Only admins can manually link
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const phoneValidation = smsService.validatePhoneNumber(parentPhone);
