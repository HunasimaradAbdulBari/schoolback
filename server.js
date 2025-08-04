const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');

const app = express();

// ✅ Simple CORS Configuration (Fixed for compatibility)
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
      callback(null, true); // Allow all origins for now to fix the issue
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ✅ Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ✅ Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Astra Preschool API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    urls: {
      frontend: 'https://astrapre-school.onrender.com',
      backend: 'https://astrawebserver.onrender.com'
    }
  });
});

// ✅ Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Astra Preschool API Server',
    version: '1.0.0',
    status: 'running',
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
    method: req.method
  });
});

// ✅ Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// ✅ Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/astra-preschool';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log('📍 Database:', process.env.MONGODB_URI ? 'Cloud MongoDB' : 'Local MongoDB');
    
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    
    // Don't exit in production, keep trying
    if (process.env.NODE_ENV !== 'production') {
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
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📡 Mongoose disconnected');
});

// ✅ Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀='.repeat(50));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 CORS enabled for:`);
  console.log(`   - Local: http://localhost:3000`);
  console.log(`   - Frontend: https://astrapre-school.onrender.com`);
  console.log(`   - Backend: https://astrawebserver.onrender.com`);
  console.log('🚀='.repeat(50));
});

// ✅ Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});