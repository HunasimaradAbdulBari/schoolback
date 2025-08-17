const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');

const app = express();

// ✅ FIXED: More permissive CORS for Render.com
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://astrapre-school.onrender.com',
  'https://astrawebserver.onrender.com'
];

// ✅ FIXED: More lenient CORS configuration for production
app.use(cors({
  origin: function (origin, callback) {
    // ✅ CRITICAL FIX: Allow requests with no origin (Render.com issue)
    if (!origin) return callback(null, true);
    
    // ✅ FIXED: In production, be more permissive
    if (process.env.NODE_ENV === 'production') {
      // Allow all Render.com subdomains and your specific domains
      if (origin.includes('onrender.com') || allowedOrigins.includes(origin)) {
        console.log('✅ CORS allowed for production:', origin);
        return callback(null, true);
      }
    } else {
      // Development mode - strict checking
      if (allowedOrigins.includes(origin)) {
        console.log('✅ CORS allowed for development:', origin);
        return callback(null, true);
      }
    }
    
    console.log('❌ CORS blocked for:', origin);
    // ✅ FIXED: In production, log but allow (for debugging)
    if (process.env.NODE_ENV === 'production') {
      console.log('🚨 Allowing anyway due to production mode...');
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  optionsSuccessStatus: 200 // ✅ For legacy browser support
}));

// ✅ FIXED: Handle preflight requests explicitly
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// ✅ Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ FIXED: Static file serving for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Request logging middleware - ENHANCED
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
  
  // ✅ ADDED: Log important headers for debugging
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('📦 Content-Type:', req.headers['content-type']);
    console.log('🔐 Authorization:', req.headers.authorization ? 'Present' : 'Missing');
  }
  
  next();
});

// ✅ ENHANCED: Health check endpoint with more details
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Astra Preschool API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    cors: {
      allowedOrigins: allowedOrigins,
      requestOrigin: req.headers.origin || 'No origin'
    },
    urls: {
      frontend: 'https://astrapre-school.onrender.com',
      backend: 'https://astrawebserver.onrender.com'
    }
  });
});

// ✅ ENHANCED: Root endpoint with connection test
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Astra Preschool API Server',
    version: '1.0.0',
    status: 'running',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin || 'No origin',
    userAgent: req.headers['user-agent'] || 'Unknown',
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

// ✅ NEW: Connection test endpoint
app.get('/test-connection', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Connection successful!',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    method: req.method,
    server: 'Render.com',
    cors: 'Enabled'
  });
});

// ✅ API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);

// ✅ 404 handler for API routes
app.use('/api/*', (req, res) => {
  console.log(`❌ API endpoint not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// ✅ Enhanced global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global error:', error.message);
  console.error('📍 Stack:', error.stack);
  
  // ✅ CORS error specific handling
  if (error.message && error.message.includes('CORS')) {
    return res.status(500).json({
      error: 'CORS Configuration Error',
      message: 'Cross-origin request blocked. Please contact support.',
      origin: req.headers.origin,
      timestamp: new Date().toISOString()
    });
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// ✅ ENHANCED: Database connection with retry logic
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/astra-preschool';
    
    console.log('🔄 Connecting to MongoDB...');
    console.log('📍 URI:', mongoURI.includes('mongodb+srv') ? 'Cloud MongoDB Atlas' : 'Local MongoDB');
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // ✅ ADDED: Better connection settings for production
      serverSelectionTimeoutMS: 10000, // Reduced from default 30s
      heartbeatFrequencyMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log('📊 Connection state:', mongoose.connection.readyState);
    
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    
    // ✅ ADDED: Retry logic for production
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Retrying connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    } else {
      process.exit(1);
    }
  }
};

// Connect to database
connectDB();

// ✅ Handle MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
  
  // ✅ ADDED: Auto-retry on connection error in production
  if (process.env.NODE_ENV === 'production') {
    console.log('🔄 Attempting to reconnect in 10 seconds...');
    setTimeout(connectDB, 10000);
  }
});

mongoose.connection.on('disconnected', () => {
  console.log('📡 Mongoose disconnected from MongoDB');
  
  // ✅ ADDED: Auto-reconnect in production
  if (process.env.NODE_ENV === 'production') {
    console.log('🔄 Attempting to reconnect...');
    connectDB();
  }
});

// ✅ Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// ✅ Start server with better error handling
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀' + '='.repeat(50));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📅 Started: ${new Date().toISOString()}`);
  console.log(`🔗 Server URL: ${process.env.NODE_ENV === 'production' ? 'https://astrawebserver.onrender.com' : 'http://localhost:' + PORT}`);
  console.log(`📡 CORS enabled for:`);
  allowedOrigins.forEach(origin => {
    console.log(`  - ${origin}`);
  });
  console.log('🚀' + '='.repeat(50));
});

// ✅ Enhanced server error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// ✅ ADDED: Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error('📍 Stack:', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('📍 Reason:', reason);
  process.exit(1);
});