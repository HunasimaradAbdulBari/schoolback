const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Enhanced auth middleware with role support
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false,
        message: 'No token, authorization denied' 
      });
    }

    // Check if token starts with 'Bearer '
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No token, authorization denied' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user with populated student data for parents
    let user;
    if (decoded.role === 'parent') {
      user = await User.findById(decoded.userId)
        .populate('studentIds', 'name studentId class feePaid balance')
        .select('-password');
    } else {
      user = await User.findById(decoded.userId).select('-password');
    }
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Token is not valid - user not found' 
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'Account is deactivated' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token is not valid' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token has expired' 
      });
    }
    
    res.status(401).json({ 
      success: false,
      message: 'Token verification failed' 
    });
  }
};

// Middleware to check if user is admin
const adminOnly = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

// Middleware to check if user is parent
const parentOnly = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'parent') {
      return res.status(403).json({
        success: false,
        message: 'Parent access required'
      });
    }

    next();
  } catch (error) {
    console.error('Parent middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

// Middleware for routes accessible by both admin and parent
const adminOrParent = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!['admin', 'parent'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    next();
  } catch (error) {
    console.error('AdminOrParent middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

// Middleware to check student access permissions
const checkStudentAccess = async (req, res, next) => {
  try {
    const studentId = req.params.id || req.body.studentId;
    
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    // Admins have access to all students
    if (req.user.role === 'admin') {
      return next();
    }

    // Parents can only access their own students
    if (req.user.role === 'parent') {
      const hasAccess = req.user.studentIds.some(
        id => id.toString() === studentId.toString()
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You can only access your own children\'s records'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Student access middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Access check failed'
    });
  }
};

module.exports = {
  auth,
  adminOnly,
  parentOnly,
  adminOrParent,
  checkStudentAccess
};
