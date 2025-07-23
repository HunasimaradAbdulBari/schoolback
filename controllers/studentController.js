const Student = require('../models/student');
const path = require('path');
const fs = require('fs');

const createStudent = async (req, res) => {
  try {
    const {
      name, class: studentClass, feePaid, balance, date,
      parentName, parentPhone, address, dateOfBirth,
      bloodGroup, allergies
    } = req.body;

    // Validate required fields
    if (!name || !studentClass || !parentName || !parentPhone || !address || !dateOfBirth || !bloodGroup) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['name', 'class', 'parentName', 'parentPhone', 'address', 'dateOfBirth', 'bloodGroup']
      });
    }

    // Handle photo upload
    let photoUrl = null;
    if (req.file) {
      photoUrl = `/uploads/${req.file.filename}`;
      console.log('Photo uploaded successfully:', photoUrl);
    }

    const student = new Student({
      name: name.trim(),
      class: studentClass,
      feePaid: parseFloat(feePaid) || 0,
      balance: parseFloat(balance) || 0,
      date: date ? new Date(date) : new Date(),
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim(),
      address: address.trim(),
      dateOfBirth: new Date(dateOfBirth),
      bloodGroup: bloodGroup.trim(),
      allergies: allergies ? allergies.trim() : '',
      createdBy: req.user._id,
      studentPhoto: photoUrl
    });

    const saved = await student.save();
    console.log('Student created successfully:', saved._id);
    
    res.status(201).json({
      message: 'Student created successfully',
      student: saved
    });
  } catch (err) {
    console.error('Create student error:', err);
    
    // Clean up uploaded file if student creation fails
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error('Failed to delete uploaded file:', unlinkErr);
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to create student',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

const getStudents = async (req, res) => {
  try {
    console.log('Fetching students for user:', req.user._id);
    const { search, class: filterClass, page = 1, limit = 10 } = req.query;
    
    let query = { createdBy: req.user._id }; // Only get students created by current user
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { parentName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (filterClass) {
      query.class = filterClass;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const students = await Student.find(query)
      .populate('createdBy', 'username name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Student.countDocuments(query);
    
    console.log(`Found ${students.length} students (${total} total)`);
    res.json({
      students,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ 
      message: 'Server error while fetching students', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid student ID format' });
    }

    // Clean up string fields
    ['name', 'parentName', 'parentPhone', 'address', 'bloodGroup', 'allergies'].forEach(field => {
      if (updates[field] && typeof updates[field] === 'string') {
        updates[field] = updates[field].trim();
      }
    });

    // Convert numeric fields
    if (updates.feePaid) updates.feePaid = parseFloat(updates.feePaid);
    if (updates.balance) updates.balance = parseFloat(updates.balance);
    
    // Convert date fields
    if (updates.dateOfBirth) updates.dateOfBirth = new Date(updates.dateOfBirth);
    if (updates.date) updates.date = new Date(updates.date);

    console.log('Updating student:', id, 'with data:', updates);

    const student = await Student.findOneAndUpdate(
      { _id: id, createdBy: req.user._id }, // Ensure user can only update their own students
      updates, 
      { 
        new: true,
        runValidators: true 
      }
    );
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found or access denied' });
    }

    console.log('Student updated successfully:', student._id);
    res.json({
      message: 'Student updated successfully',
      student
    });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ 
      message: 'Server error while updating student', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid student ID format' });
    }

    console.log('Deleting student:', id);

    const student = await Student.findOneAndDelete({ 
      _id: id, 
      createdBy: req.user._id // Ensure user can only delete their own students
    });
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found or access denied' });
    }

    // Clean up associated photo file
    if (student.studentPhoto) {
      const photoPath = path.join(__dirname, '..', student.studentPhoto);
      fs.unlink(photoPath, (err) => {
        if (err) console.error('Failed to delete photo file:', err);
        else console.log('Photo file deleted:', photoPath);
      });
    }

    console.log('Student deleted successfully:', student.name);
    res.json({ 
      message: 'Student deleted successfully',
      deletedStudent: {
        _id: student._id,
        name: student.name
      }
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ 
      message: 'Server error while deleting student', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  createStudent,
  getStudents,
  updateStudent,
  deleteStudent,
};