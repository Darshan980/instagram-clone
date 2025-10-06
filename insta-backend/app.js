const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');


// Load environment variables first
dotenv.config();

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Essential middleware setup
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0 && req.method !== 'GET') {
    console.log('Request Body Keys:', Object.keys(req.body));
  }
  next();
});

// Database connection with retry logic
const connectDB = async () => {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/instagram-clone';
      
      const conn = await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      
      // Connection event handlers
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
      });
      
      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected');
      });
      
      return; // Exit retry loop on successful connection
      
    } catch (error) {
      console.error(`Database connection attempt ${retries + 1} failed:`, error.message);
      retries++;
      
      if (retries === maxRetries) {
        console.error('Max database connection retries reached. Exiting...');
        process.exit(1);
      }
      
      console.log(`Retrying in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

// Initialize database connection
connectDB();

// Import routes with error handling
const importRoute = (routePath, routeName) => {
  try {
    console.log(`Importing ${routeName} routes...`);
    const route = require(routePath);
    console.log(`${routeName} routes imported successfully`);
    return route;
  } catch (error) {
    console.error(`Failed to import ${routeName} routes:`, error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

// Import all routes
const authRoutes = importRoute('./routes/auth.js', 'auth');
const userRoutes = importRoute('./routes/user.js', 'user');
const messageRoutes = importRoute('./routes/message.js', 'message');
const conversationRoutes = importRoute('./routes/conversation.js', 'conversation');
const notificationRoutes = importRoute('./routes/notification.js', 'notification');
const postRoutes = importRoute('./routes/post.js', 'post');
const reelRoutes = importRoute('./routes/reel.js', 'reel');
const storyRoutes = importRoute('./routes/story.js', 'story');
const settingsRoutes = importRoute('./routes/settings/index.js', 'settings'); // New settings routes
const liveRoutes = importRoute('./routes/live.js', 'live'); // Live streaming routes

// Import middleware
const { authenticateToken, optionalAuth } = require('./middleware/auth.js');

// Health check routes
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  };
  
  res.status(200).json(healthCheck);
});

app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    version: '1.0.0'
  };
  
  res.status(200).json(healthCheck);
});

// Root route with comprehensive API documentation
app.get('/', (req, res) => {
  res.json({ 
    message: 'Instagram Clone API',
    version: '1.0.0',
    status: 'Online',
    documentation: {
      health: 'GET /health - Server health check',
      apiHealth: 'GET /api/health - API health check',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        me: 'GET /api/auth/me',
        refresh: 'POST /api/auth/refresh'
      },
      users: {
        profile: 'GET /api/users/:identifier',
        search: 'GET /api/users/search/:query',
        suggestions: 'GET /api/users/suggestions',
        updateProfile: 'PUT /api/users/profile',
        follow: 'POST /api/users/follow/:userId',
        unfollow: 'POST /api/users/unfollow/:userId',
        followers: 'GET /api/users/:userId/followers',
        following: 'GET /api/users/:userId/following',
        settings: {
          account: 'PUT /api/users/account',
          privacy: 'PUT /api/users/privacy',
          notifications: 'PUT /api/users/notifications',
          password: 'PUT /api/users/password',
          block: 'POST /api/users/block/:userId',
          unblock: 'POST /api/users/unblock/:userId',
          blockedUsers: 'GET /api/users/blocked-users',
          report: 'POST /api/users/report',
          deactivate: 'POST /api/users/deactivate',
          delete: 'POST /api/users/delete-account'
        }
      },
      settings: {
        getAll: 'GET /api/settings - Get all user settings',
        updateAccount: 'PUT /api/settings/account - Update account information',
        updatePrivacy: 'PUT /api/settings/privacy - Update privacy settings',
        updateNotifications: 'PUT /api/settings/notifications - Update notification preferences',
        auth: {
          changePassword: 'PUT /api/settings/auth/password - Change password',
          changeEmail: 'PUT /api/settings/auth/email - Change email',
          deactivate: 'POST /api/settings/auth/deactivate - Deactivate account',
          reactivate: 'POST /api/settings/auth/reactivate - Reactivate account',
          securitySettings: 'GET /api/settings/auth/security-settings - Get security settings',
          updateSecuritySettings: 'PUT /api/settings/auth/security-settings - Update security settings'
        }
      },
      posts: {
        feed: 'GET /api/posts/feed',
        explore: 'GET /api/posts/explore',
        userPosts: 'GET /api/posts/user/:userId',
        getPost: 'GET /api/posts/:id',
        createPost: 'POST /api/posts',
        deletePost: 'DELETE /api/posts/:id',
        likePost: 'POST /api/posts/:id/like',
        comment: 'POST /api/posts/:id/comment'
      },
      messages: {
        getMessages: 'GET /api/messages/:userId',
        sendMessage: 'POST /api/messages',
        markRead: 'PUT /api/messages/:userId/read',
        deleteMessage: 'DELETE /api/messages/:messageId',
        searchMessages: 'GET /api/messages/search/:query'
      },
      conversations: {
        getConversations: 'GET /api/conversations'
      },
      notifications: {
        getNotifications: 'GET /api/notifications',
        markRead: 'PUT /api/notifications/:id/read',
        deleteNotification: 'DELETE /api/notifications/:id'
      },
      reels: {
        getReels: 'GET /api/reels',
        createReel: 'POST /api/reels',
        getReel: 'GET /api/reels/:id',
        deleteReel: 'DELETE /api/reels/:id'
      },
      stories: {
        getStories: 'GET /api/stories',
        createStory: 'POST /api/stories',
        getStory: 'GET /api/stories/:id',
        deleteStory: 'DELETE /api/stories/:id'
      },
      live: {
        startStream: 'POST /api/live/start',
        getActiveStreams: 'GET /api/live/active',
        getStream: 'GET /api/live/:streamId',
        joinStream: 'POST /api/live/:streamId/join',
        leaveStream: 'POST /api/live/:streamId/leave',
        likeStream: 'POST /api/live/:streamId/like',
        commentOnStream: 'POST /api/live/:streamId/comment',
        endStream: 'POST /api/live/:streamId/end',
        getUserStreams: 'GET /api/live/user/:userId/streams',
        getMyActiveStream: 'GET /api/live/my/active'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Route setup with error handling
const setupRoute = (path, router, name) => {
  try {
    console.log(`Setting up ${name} routes at ${path}...`);
    app.use(path, router);
    console.log(`${name} routes setup completed`);
  } catch (error) {
    console.error(`Failed to setup ${name} routes:`, error.message);
    process.exit(1);
  }
};

// Setup all routes
setupRoute('/api/auth', authRoutes, 'authentication');
setupRoute('/api/users', userRoutes, 'user');
setupRoute('/api/messages', messageRoutes, 'message');
setupRoute('/api/conversations', conversationRoutes, 'conversation');
setupRoute('/api/notifications', notificationRoutes, 'notification');
setupRoute('/api/posts', postRoutes, 'post');
setupRoute('/api/reels', reelRoutes, 'reel');
setupRoute('/api/stories', storyRoutes, 'story');
setupRoute('/api/settings', settingsRoutes, 'settings'); // New settings routes
setupRoute('/api/live', liveRoutes, 'live'); // Live streaming routes

console.log('All routes configured successfully');

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Detailed API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Instagram Clone API Documentation',
    version: '1.0.0',
    description: 'Complete API documentation for Instagram Clone',
    baseURL: process.env.API_BASE_URL || 'http://localhost:5000',
    authentication: 'Bearer Token required for protected endpoints',
    endpoints: {
      authentication: {
        login: {
          method: 'POST',
          path: '/api/auth/login',
          body: { email: 'string', password: 'string' },
          response: { token: 'string', user: 'object' }
        },
        register: {
          method: 'POST',
          path: '/api/auth/register',
          body: { username: 'string', email: 'string', password: 'string', fullName: 'string' },
          response: { token: 'string', user: 'object' }
        },
        getCurrentUser: {
          method: 'GET',
          path: '/api/auth/me',
          headers: { Authorization: 'Bearer <token>' },
          response: { user: 'object' }
        }
      },
      users: {
        getProfile: {
          method: 'GET',
          path: '/api/users/:identifier',
          description: 'Get user profile by username or ID'
        },
        searchUsers: {
          method: 'GET',
          path: '/api/users/search/:query',
          queryParams: { page: 'number', limit: 'number' }
        },
        getUserSuggestions: {
          method: 'GET',
          path: '/api/users/suggestions',
          queryParams: { limit: 'number', page: 'number' }
        }
      },
      settings: {
        getAllSettings: {
          method: 'GET',
          path: '/api/settings',
          description: 'Get all user settings (account, privacy, notifications, security)'
        },
        updateAccount: {
          method: 'PUT',
          path: '/api/settings/account',
          body: { fullName: 'string', bio: 'string', website: 'string', phoneNumber: 'string', gender: 'string', dateOfBirth: 'date' }
        },
        updatePrivacy: {
          method: 'PUT',
          path: '/api/settings/privacy',
          body: { isPrivate: 'boolean', showOnlineStatus: 'boolean', allowTagging: 'boolean', allowMessagesFromStrangers: 'boolean' }
        },
        updateNotifications: {
          method: 'PUT',
          path: '/api/settings/notifications',
          body: { likes: 'boolean', comments: 'boolean', follows: 'boolean', mentions: 'boolean', messages: 'boolean' }
        },
        changePassword: {
          method: 'PUT',
          path: '/api/settings/auth/password',
          body: { currentPassword: 'string', newPassword: 'string', confirmNewPassword: 'string' }
        },
        changeEmail: {
          method: 'PUT',
          path: '/api/settings/auth/email',
          body: { newEmail: 'string', password: 'string' }
        },
        deactivateAccount: {
          method: 'POST',
          path: '/api/settings/auth/deactivate',
          body: { password: 'string', reason: 'string (optional)' }
        },
        getSecuritySettings: {
          method: 'GET',
          path: '/api/settings/auth/security-settings',
          description: 'Get security-related settings and account info'
        }
      }
    },
    errorCodes: {
      400: 'Bad Request - Invalid input data',
      401: 'Unauthorized - Invalid or missing token',
      403: 'Forbidden - Insufficient permissions',
      404: 'Not Found - Resource does not exist',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error - Server malfunction'
    },
    rateLimit: 'Standard rate limiting applies to all endpoints',
    timestamp: new Date().toISOString()
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  console.log(`404 - API endpoint not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false,
    error: 'API endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: '/api/docs',
    timestamp: new Date().toISOString(),
    suggestion: 'Check the API documentation at /api/docs for available endpoints'
  });
});

// 404 handler for all other routes
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    suggestion: 'Visit / for API information or /api/docs for documentation'
  });
});

// Enhanced global error handling middleware
app.use((err, req, res, next) => {
  console.error('=== ERROR DETAILS ===');
  console.error('Time:', new Date().toISOString());
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('URL:', req.originalUrl);
  console.error('Method:', req.method);
  console.error('IP:', req.ip);
  console.error('User Agent:', req.get('User-Agent'));
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.error('Body Keys:', Object.keys(req.body));
  }
  
  if (req.headers.authorization) {
    console.error('Auth Header:', 'Present');
  }
  
  console.error('====================');
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      messages: errors,
      timestamp: new Date().toISOString()
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      error: 'Duplicate Error',
      message: `${field} already exists`,
      timestamp: new Date().toISOString()
    });
  }
  
  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID Format',
      message: 'Invalid resource ID provided',
      timestamp: new Date().toISOString()
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid Token',
      message: 'The provided token is invalid',
      timestamp: new Date().toISOString()
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token Expired',
      message: 'The provided token has expired',
      timestamp: new Date().toISOString()
    });
  }
  
  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File Too Large',
      message: 'File size exceeds the allowed limit',
      maxSize: '10MB',
      timestamp: new Date().toISOString()
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      error: 'Too Many Files',
      message: 'Number of files exceeds the allowed limit',
      timestamp: new Date().toISOString()
    });
  }
  
  // Database connection errors
  if (err.name === 'MongooseError' || err.name === 'MongoError') {
    return res.status(503).json({
      success: false,
      error: 'Database Error',
      message: 'Database service temporarily unavailable',
      timestamp: new Date().toISOString()
    });
  }
  
  // Default error response
  const statusCode = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(statusCode).json({
    success: false,
    error: statusCode >= 500 ? 'Internal Server Error' : 'Request Error',
    message: isProduction ? 'Something went wrong' : err.message,
    timestamp: new Date().toISOString(),
    ...(statusCode === 500 && { requestId: req.id }),
    ...(!isProduction && { 
      stack: err.stack,
      details: {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
      }
    })
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err.message);
  console.error('Stack:', err.stack);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('=================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/docs`);
  console.log(`🌐 CORS enabled for: ${corsOptions.origin}`);
  console.log('=================================');
});

module.exports = app;