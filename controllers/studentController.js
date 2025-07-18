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

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const student = new Student({
      name, 
      class: studentClass, 
      feePaid: Number(feePaid) || 0, 
      balance: Number(balance) || 0, 
      date: date ? new Date(date) : new Date(),
      parentName, 
      parentPhone, 
      address, 
      dateOfBirth: new Date(dateOfBirth),
      bloodGroup, 
      allergies: allergies || '', 
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
    res.status(500).json({ 
      message: 'Server error while creating student', 
      error: err.message 
    });
  }
};

const getStudents = async (req, res) => {
  try {
    console.log('Fetching students for user:', req.user._id);
    const { search } = req.query;
    let query = { createdBy: req.user._id }; // Only get students created by this user
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const students = await Student.find(query)
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${students.length} students`);
    res.json({
      message: 'Students fetched successfully',
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
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid student ID' });
    }

    // Convert string numbers to numbers
    if (updates.feePaid) updates.feePaid = Number(updates.feePaid);
    if (updates.balance) updates.balance = Number(updates.balance);
    if (updates.dateOfBirth) updates.dateOfBirth = new Date(updates.dateOfBirth);

    const student = await Student.findOneAndUpdate(
      { _id: id, createdBy: req.user._id }, // Only update if user owns this student
      updates, 
      { 
        new: true,
        runValidators: true 
      }
    );
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found or unauthorized' });
    }

    console.log('Student updated successfully:', student);
    res.json({
      message: 'Student updated successfully',
      student: student
    });
  } catch (error) {
    console.error('Error updating student:', error);
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
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid student ID' });
    }

    const student = await Student.findOneAndDelete({
      _id: id,
      createdBy: req.user._id // Only delete if user owns this student
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found or unauthorized' });
    }

    console.log('Student deleted successfully:', student.name);
    res.json({ 
      message: 'Student deleted successfully',
      deletedStudent: student.name
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