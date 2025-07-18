const Student = require('../models/student');

const createStudent = async (req, res) => {
  try {
    console.log('Creating student with data:', req.body);
    console.log('User ID:', req.user._id);
    console.log('File:', req.file);

    const {
      name, 
      class: studentClass, 
      feePaid, 
      balance, 
      date,
      parentName, 
      parentPhone, 
      address, 
      dateOfBirth,
      bloodGroup, 
      allergies
    } = req.body;

    // Validate required fields
    if (!name || !studentClass || !parentName || !parentPhone || !address || !dateOfBirth || !bloodGroup) {
      return res.status(400).json({ 
        message: 'Missing required fields: name, class, parentName, parentPhone, address, dateOfBirth, bloodGroup' 
      });
    }

    // Validate class enum
    const validClasses = ['Play Group', 'Nursery', 'LKG', 'UKG'];
    if (!validClasses.includes(studentClass)) {
      return res.status(400).json({ 
        message: `Invalid class. Must be one of: ${validClasses.join(', ')}` 
      });
    }

    // Validate and parse date of birth
    const dobDate = new Date(dateOfBirth);
    if (isNaN(dobDate.getTime())) {
      return res.status(400).json({ 
        message: 'Invalid date of birth format' 
      });
    }

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const student = new Student({
      name: name.trim(), 
      class: studentClass, 
      feePaid: Number(feePaid) || 0, 
      balance: Number(balance) || 0, 
      date: date ? new Date(date) : new Date(),
      parentName: parentName.trim(), 
      parentPhone: parentPhone.trim(), 
      address: address.trim(), 
      dateOfBirth: dobDate,
      bloodGroup: bloodGroup.trim(), 
      allergies: allergies ? allergies.trim() : '', 
      createdBy: req.user._id,
      studentPhoto: photoUrl
    });

    console.log('Student object before save:', student);

    const saved = await student.save();
    console.log('Student saved successfully:', saved);

    res.status(201).json({
      message: 'Student created successfully',
      student: saved
    });
  } catch (err) {
    console.error('Error creating student:', err);
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: errors 
      });
    }

    res.status(500).json({ 
      message: 'Server error while creating student', 
      error: err.message 
    });
  }
};

const getStudents = async (req, res) => {
  try {
    console.log('Fetching students for user:', req.user._id);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        message: 'User not authenticated' 
      });
    }

    const { search } = req.query;
    let query = { createdBy: req.user._id }; // Only get students created by this user
    
    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: 'i' };
    }

    const students = await Student.find(query)
      .populate('createdBy', 'username name')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${students.length} students`);
    
    res.status(200).json({
      message: 'Students fetched successfully',
      count: students.length,
      students: students
    });
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

    console.log('Updating student:', id, 'with data:', updates);

    // Validate ObjectId
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid student ID' });
    }

    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Clean and validate updates
    const cleanUpdates = {};
    
    if (updates.name) cleanUpdates.name = updates.name.trim();
    if (updates.class) cleanUpdates.class = updates.class;
    if (updates.feePaid !== undefined) cleanUpdates.feePaid = Number(updates.feePaid);
    if (updates.balance !== undefined) cleanUpdates.balance = Number(updates.balance);
    if (updates.parentName) cleanUpdates.parentName = updates.parentName.trim();
    if (updates.parentPhone) cleanUpdates.parentPhone = updates.parentPhone.trim();
    if (updates.address) cleanUpdates.address = updates.address.trim();
    if (updates.bloodGroup) cleanUpdates.bloodGroup = updates.bloodGroup.trim();
    if (updates.allergies !== undefined) cleanUpdates.allergies = updates.allergies ? updates.allergies.trim() : '';
    
    if (updates.dateOfBirth) {
      const dobDate = new Date(updates.dateOfBirth);
      if (isNaN(dobDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date of birth format' });
      }
      cleanUpdates.dateOfBirth = dobDate;
    }

    // Validate class if provided
    if (cleanUpdates.class) {
      const validClasses = ['Play Group', 'Nursery', 'LKG', 'UKG'];
      if (!validClasses.includes(cleanUpdates.class)) {
        return res.status(400).json({ 
          message: `Invalid class. Must be one of: ${validClasses.join(', ')}` 
        });
      }
    }

    const student = await Student.findOneAndUpdate(
      { _id: id, createdBy: req.user._id }, // Only update if user owns this student
      cleanUpdates, 
      { 
        new: true,
        runValidators: true 
      }
    );
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found or unauthorized' });
    }

    console.log('Student updated successfully:', student);
    res.status(200).json({
      message: 'Student updated successfully',
      student: student
    });
  } catch (error) {
    console.error('Error updating student:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: errors 
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

    // Validate ObjectId
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid student ID' });
    }

    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const student = await Student.findOneAndDelete({
      _id: id,
      createdBy: req.user._id // Only delete if user owns this student
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found or unauthorized' });
    }

    console.log('Student deleted successfully:', student.name);
    res.status(200).json({ 
      message: 'Student deleted successfully',
      deletedStudent: {
        id: student._id,
        name: student.name
      }
    });
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