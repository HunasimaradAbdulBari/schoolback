const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');

const app = express();

// ✅ ENHANCED: More robust CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://astrapre-school.onrender.com',
  'https://astrawebserver.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS allowed for:', origin);
      callback(null, true);
    } else {
      console.log('❌ CORS blocked for:', origin);
      // 🔧 FIXED: Proper CORS rejection with better error handling
      const corsError = new Error(`CORS policy violation: Origin ${origin} not allowed`);
      corsError.status = 403;
      callback(corsError, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ✅ Body parsing middleware with enhanced limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Enhanced request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const origin = req.get('Origin') || 'No Origin';
  console.log(`${timestamp} - ${req.method} ${req.path} - Origin: ${origin}`);
  next();
});

// ✅ Health check endpoint with more details
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Astra Preschool API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    urls: {
      frontend: 'https://astrapre-school.onrender.com',
      backend: 'https://astrawebserver.onrender.com'
    },
    version: '1.0.0'
  });
});

// ✅ Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Astra Preschool API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    urls: {
      frontend: 'https://astrapre-school.onrender.com',
      backend: 'https://astrawebserver.onrender.com'
    },
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      students: '/api/students'
    }
  });
});

// ✅ API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);

// ✅ 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: ['/api/auth', '/api/students']
  });
});

// ✅ ENHANCED: Better global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global error:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // 🔧 ENHANCED: Handle specific error types
  if (error.message && error.message.includes('CORS policy violation')) {
    return res.status(403).json({
      error: 'CORS policy violation',
      message: 'Origin not allowed by CORS policy',
      timestamp: new Date().toISOString()
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
      message: 'The provided ID is not valid',
      timestamp: new Date().toISOString()
    });
  }

  // Generic error response
  const statusCode = error.status || error.statusCode || 500;
  res.status(statusCode).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ✅ ENHANCED: Database connection with retry logic
const connectDB = async (retryCount = 0) => {
  const maxRetries = 5;
  const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s

  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/astra-preschool';
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 second timeout
      heartbeatFrequencyMS: 2000, // Check connection every 2 seconds
    });
    console.log('✅ MongoDB connected successfully');
    console.log('📍 Database:', process.env.MONGODB_URI ? 'Cloud MongoDB' : 'Local MongoDB');
  } catch (err) {
    console.error(`❌ MongoDB connection error (attempt ${retryCount + 1}/${maxRetries}):`, err.message);
    
    if (retryCount < maxRetries - 1) {
      console.log(`⏳ Retrying connection in ${retryDelay}ms...`);
      setTimeout(() => connectDB(retryCount + 1), retryDelay);
    } else {
      console.error('❌ Max retry attempts reached. Could not connect to MongoDB.');
      // Don't exit in production, but log the error
      if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
      }
    }
  }
};

// Connect to database
connectDB();

// ✅ Enhanced MongoDB connection event handlers
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📡 Mongoose disconnected - attempting to reconnect...');
  // Attempt to reconnect
  if (process.env.NODE_ENV === 'production') {
    setTimeout(connectDB, 5000);
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('📡 Mongoose reconnected to MongoDB');
});

// ✅ Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`🛑 ${signal} received. Shutting down gracefully...`);
  
  try {
    // Close server first
    if (server) {
      await new Promise((resolve) => {
        server.close((err) => {
          if (err) console.error('❌ Error closing server:', err);
          else console.log('✅ Server closed');
          resolve();
        });
      });
    }
    
    // Then close database connection
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ✅ Start server with enhanced error handling
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀=' .repeat(50));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 CORS enabled for:`);
  console.log(`  - Local: http://localhost:3000`);
  console.log(`  - Frontend: https://astrapre-school.onrender.com`);
  console.log(`  - Backend: https://astrawebserver.onrender.com`);
  console.log(`🗄️  Database: ${process.env.MONGODB_URI ? 'Cloud MongoDB' : 'Local MongoDB'}`);
  console.log('🚀=' .repeat(50));
});

// ✅ Enhanced server error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// 🔧 ADDED: Uncaught exception handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});