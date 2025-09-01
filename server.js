const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: ['https://schoolfront-1.onrender.com', 'http://localhost:3000'], 
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic health check route
app.get('/', (req, res) => {
  res.json({ message: 'Server is running successfully!' });
});

// Database connection - FIXED: Removed deprecated options
const connectDB = async () => {
  try {
    // ✅ FIXED: Remove deprecated options
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// Routes - Import after DB connection
try {
  const authRoutes = require('./routes/auth');
  const studentRoutes = require('./routes/students');
  
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  
  console.log('✅ Routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading routes:', error);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// ✅ FIXED: Ensure correct port is used
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📂 Environment: ${process.env.NODE_ENV || 'development'}`);
});
