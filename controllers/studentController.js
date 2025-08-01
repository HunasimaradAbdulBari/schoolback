const Student = require('../models/student');

const createStudent = async (req, res) => {
  try {
    console.log('Creating student with data:', req.body);
    console.log('User creating student:', req.user);
    
    const { name, class: studentClass, feePaid, balance, date } = req.body;
    
    // Validate required fields
    if (!name || !studentClass || feePaid === undefined || balance === undefined) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['name', 'class', 'feePaid', 'balance']
      });
    }
    
    const student = new Student({
      name,
      class: studentClass,
      feePaid: Number(feePaid),
      balance: Number(balance),
      date: date || new Date(),
      createdBy: req.user._id,
    });

    console.log('Student object before save:', student);
    
    const savedStudent = await student.save();
    console.log('Student saved successfully:', savedStudent);
    
    res.status(201).json(savedStudent);
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ 
      message: 'Server error while creating student', 
      error: error.message,
      details: error
    });
  }
};

const getStudents = async (req, res) => {
  try {
    console.log('Fetching students for user:', req.user._id);
    const { search } = req.query;
    let query = {};
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
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

    console.log('Student deleted successfully:', student.name);
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