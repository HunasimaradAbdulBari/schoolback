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
  res.json({ 
    message: 'Astra Preschool Management System is running successfully!',
    version: '2.0.0',
    features: ['Role-based Authentication', 'UPI Payments', 'SMS Notifications'],
    timestamp: new Date().toISOString()
  });
});

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Log database info
    console.log(`Database: ${conn.connection.db.databaseName}`);
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// Routes - Import after DB connection
try {
  const authRoutes = require('./routes/auth');
  const studentRoutes = require('./routes/students');
  const paymentRoutes = require('./routes/payments'); // NEW: Payment routes
  
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/payments', paymentRoutes); // NEW: Payment API endpoints
  
  console.log('✅ All routes loaded successfully');
  console.log('Available routes:');
  console.log('  - /api/auth/* (Authentication & Registration)');
  console.log('  - /api/students/* (Student Management)');
  console.log('  - /api/payments/* (Payment Processing)');
} catch (error) {
  console.error('❌ Error loading routes:', error);
  process.exit(1);
}

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate entry found'
    });
  }

  // Default error response
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Handle 404 for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Astra Preschool Server running on port ${PORT}`);
  console.log(`📂 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for frontend deployments`);
  console.log(`💳 UPI Payment system ready`);
  console.log(`📱 SMS notification system ready`);
  console.log('='.repeat(50));
});
