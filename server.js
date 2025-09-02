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
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
});

// Enhanced health check for monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.db.databaseName}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Initialize database connection
connectDB();

// Routes - Import with error handling
try {
  console.log('🔄 Loading routes...');
  
  // Basic routes (always work)
  const authRoutes = require('./routes/auth');
  const studentRoutes = require('./routes/students');
  
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  
  // Enhanced routes (may fail if dependencies missing)
  try {
    const paymentRoutes = require('./routes/payments');
    app.use('/api/payments', paymentRoutes);
    console.log('✅ Payment routes loaded successfully');
  } catch (paymentError) {
    console.warn('⚠️ Payment routes not available:', paymentError.message);
    
    // Create minimal payment routes fallback
    app.use('/api/payments', (req, res) => {
      res.status(503).json({
        success: false,
        message: 'Payment system is not configured. Please contact administrator.',
        feature: 'UPI Payments'
      });
    });
  }
  
  console.log('✅ Core routes loaded successfully');
  
} catch (error) {
  console.error('❌ Critical error loading routes:', error);
  
  // Fallback routes for basic functionality
  app.use('/api/*', (req, res) => {
    res.status(503).json({ 
      success: false, 
      message: 'Service temporarily unavailable. Some features may not work.',
      error: 'Routes loading failed'
    });
  });
}

// API documentation route
app.get('/api', (req, res) => {
  res.json({
    message: 'Astra Preschool Management API',
    version: '2.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/login': 'User login (admin/parent)',
        'POST /api/auth/register': 'Admin registration',
        'POST /api/auth/send-otp': 'Send OTP for parent registration',
        'POST /api/auth/verify-otp-register': 'Verify OTP and register parent',
        'GET /api/auth/profile': 'Get user profile'
      },
      students: {
        'GET /api/students': 'Get students (role-based)',
        'POST /api/students': 'Create student (admin only)',
        'PUT /api/students/:id': 'Update student (role-based)',
        'DELETE /api/students/:id': 'Delete student (admin only)'
      },
      payments: {
        'POST /api/payments/generate-qr': 'Generate UPI QR code',
        'POST /api/payments/confirm': 'Confirm payment',
        'GET /api/payments/history': 'Get payment history',
        'POST /api/payments/verify': 'Verify payment (admin only)'
      }
    },
    features: {
      roles: ['admin', 'parent'],
      authentication: 'JWT token-based',
      payments: 'UPI QR code system',
      notifications: 'SMS via email gateways'
    }
  });
});

// Migration endpoint (admin use)
app.post('/api/migrate', async (req, res) => {
  try {
    // Only allow in development or with admin token
    if (process.env.NODE_ENV === 'production') {
      const authHeader = req.header('Authorization');
      if (!authHeader || !authHeader.includes('admin')) {
        return res.status(403).json({ message: 'Migration access denied' });
      }
    }
    
    // Try to run migration
    const { runMigration } = require('./scripts/migrate');
    await runMigration();
    
    res.json({ 
      success: true, 
      message: 'Database migration completed successfully' 
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Migration failed: ' + error.message 
    });
  }
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('🚨 Global error handler:', err.stack);
  
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

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
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
    method: req.method,
    suggestion: 'Check /api for available endpoints'
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`🛑 ${signal} received, shutting down gracefully...`);
  
  // Close database connection
  mongoose.connection.close(() => {
    console.log('📊 Database connection closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 Astra Preschool Server running on port ${PORT}`);
  console.log(`📂 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for frontend deployments`);
  console.log(`💳 UPI Payment system: ${process.env.SCHOOL_UPI_ID ? 'configured' : 'not configured'}`);
  console.log(`📱 SMS notification system: ${process.env.EMAIL_USER ? 'configured' : 'not configured'}`);
  console.log(`🔗 API Documentation: http://localhost:${PORT}/api`);
  console.log(`💊 Health Check: http://localhost:${PORT}/health`);
  console.log('='.repeat(60) + '\n');
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

module.exports = app;
