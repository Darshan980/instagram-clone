const express = require('express');
// ... other imports
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Import models
const Reel = require('./schema/reel');

// Import routes
const reelsRoutes = require('./routes/reels');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Check if Cloudinary credentials are configured
const isCloudinaryConfigured = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  return CLOUDINARY_CLOUD_NAME && 
         CLOUDINARY_API_KEY && 
         CLOUDINARY_API_SECRET &&
         CLOUDINARY_CLOUD_NAME !== 'your-cloud-name' &&
         CLOUDINARY_API_KEY !== 'your-api-key' &&
         CLOUDINARY_API_SECRET !== 'your-api-secret';
};

// Configure Cloudinary only if credentials are available
if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary configured successfully');
} else {
  console.log('⚠️  Cloudinary not configured. Image uploads will be disabled.');
  console.log('📝 To enable image uploads:');
  console.log('   1. Sign up at https://cloudinary.com');
  console.log('   2. Get your Cloud Name, API Key, and API Secret');
  console.log('   3. Update the .env file with your credentials');
}

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// MongoDB Connection with better error handling
const connectDB = async (retryCount = 0) => {
  try {
    // Check if it's a local or Atlas connection
    const isAtlas = process.env.MONGODB_URI.includes('mongodb+srv://');
    
    let mongoOptions = {
      serverSelectionTimeoutMS: isAtlas ? 5000 : 2000,  // Shorter timeout for Atlas
      socketTimeoutMS: 45000,
      connectTimeoutMS: isAtlas ? 10000 : 5000,
      maxPoolSize: 10,
      minPoolSize: 5,
      retryWrites: true,
      retryReads: true,
    };

    // Add SSL options only for Atlas connections
    if (isAtlas) {
      mongoOptions = {
        ...mongoOptions,
        tls: true,
        tlsAllowInvalidCertificates: true, // For development only
        tlsAllowInvalidHostnames: true,   // For development only
      };
    }

    console.log(`🔄 Attempting to connect to ${isAtlas ? 'Atlas' : 'Local'} MongoDB...`);
    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    console.log(`✅ MongoDB connected successfully to ${isAtlas ? 'Atlas' : 'Local'} database`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    // Try local MongoDB as fallback after 2 Atlas failures
    if (retryCount < 2 && process.env.MONGODB_URI.includes('mongodb+srv://')) {
      console.log(`🔄 Retrying Atlas connection (${retryCount + 1}/2)...`);
      setTimeout(() => connectDB(retryCount + 1), 3000);
    } else if (retryCount === 2 && process.env.MONGODB_URI.includes('mongodb+srv://')) {
      console.log('🔄 Switching to local MongoDB fallback...');
      process.env.MONGODB_URI = 'mongodb://localhost:27017/instagram-clone';
      setTimeout(() => connectDB(retryCount + 1), 2000);
    } else {
      console.log('\n🔧 MONGODB CONNECTION TROUBLESHOOTING:');
      if (process.env.MONGODB_URI.includes('mongodb+srv://')) {
        console.log('1. Check your internet connection');
        console.log('2. Verify MongoDB Atlas cluster is running');
        console.log('3. Check if your IP is whitelisted in MongoDB Atlas');
      } else {
        console.log('1. Install MongoDB Community Server');
        console.log('2. Start MongoDB service');
        console.log('3. Or use Atlas by updating MONGODB_URI in .env');
      }
      
      if (retryCount < 5) {
        console.log(`Retrying in 5 seconds... (${retryCount + 1}/5)`);
        setTimeout(() => connectDB(retryCount + 1), 5000);
      } else {
        console.log('❌ Max retries reached. Please fix MongoDB connection manually.');
      }
    }
  }
};

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  profilePicture: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: '',
    maxlength: 150
  },
  followers: [ {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [ {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  posts: [ {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }]
}, {
  timestamps: true
});
console.log('🎬 Defining Reel schema...');

const ReelSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  videoUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  cloudinaryId: {
    type: String,
    default: null
  },
  caption: {
    type: String,
    maxLength: 2200,
    default: ''
  },
  hashtags: [{
    type: String,
    trim: true
  }],
  musicTrack: {
    name: String,
    artist: String,
    url: String
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      maxLength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  views: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  shares: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0
  },
  aspectRatio: {
    type: String,
    default: '9:16'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add indexes
ReelSchema.index({ user: 1, createdAt: -1 });
ReelSchema.index({ hashtags: 1 });
ReelSchema.index({ createdAt: -1 });
ReelSchema.index({ isActive: 1 });

// Add view tracking method
ReelSchema.methods.addView = function(userId) {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const recentView = this.views.find(view => 
    view.user && view.user.toString() === userId.toString() && 
    view.viewedAt > twentyFourHoursAgo
  );
  
  if (!recentView) {
    this.views.push({ user: userId, viewedAt: now });
    return this.save().then(() => this.views.length);
  }
  
  return Promise.resolve(this.views.length);
};

// Create the Reel model
const Reel = mongoose.model('Reel', ReelSchema);
console.log('✅ Reel model created successfully');
// Post Schema
const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caption: {
    type: String,
    maxlength: 2200,
    trim: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  cloudinaryId: {
    type: String,
    required: false // Make this optional for fallback scenarios
  },
  likes: [ {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [ {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  location: {
    type: String,
    maxlength: 100
  },
  tags: [ {
    type: String,
    maxlength: 50
  }]
}, {
  timestamps: true
});

// Notification Schema
const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'comment', 'follow'],
    required: true
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: false
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Add index for better query performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

// Message Schema
const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: function() {
      return !this.imageUrl; // Text is required if no image
    },
    maxlength: 1000
  },
  imageUrl: {
    type: String,
    required: false
  },
  cloudinaryId: {
    type: String,
    required: false
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, isRead: 1 });

// Conversation Schema (for easier conversation management)
const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add index for participants
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

// Story Schema with enhanced user tracking
const storySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mediaUrl: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    required: true,
    default: 'image'
  },
  caption: {
    type: String,
    maxlength: 500,
    default: ''
  },
  cloudinaryId: {
    type: String,
    required: false
  },
  views: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    }
  }
}, {
  timestamps: true
});

// Story indexes for performance
storySchema.index({ userId: 1, createdAt: -1 });
storySchema.index({ expiresAt: 1 });
storySchema.index({ isActive: 1, expiresAt: 1 });

// Story methods
storySchema.methods.addView = async function(userId) {
  // Check if user already viewed this story
  const existingView = this.views.find(view => 
    view.userId.toString() === userId.toString()
  );

  if (!existingView) {
    this.views.push({ userId, viewedAt: new Date() });
    await this.save();
  }
  
  return this.views.length;
};

// Static method to cleanup expired stories
storySchema.statics.cleanupExpiredStories = async function() {
  try {
    const expiredStories = await this.find({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { isActive: false }
      ]
    });

    // Delete media from Cloudinary for expired stories
    for (const story of expiredStories) {
      if (story.cloudinaryId && isCloudinaryConfigured()) {
        try {
          await cloudinary.uploader.destroy(story.cloudinaryId, {
            resource_type: story.mediaType === 'video' ? 'video' : 'image'
          });
        } catch (error) {
          console.error('Error deleting expired story media:', error);
        }
      }
    }

    // Delete expired stories from database
    const result = await this.deleteMany({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { isActive: false }
      ]
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} expired stories`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error during story cleanup:', error);
    return 0;
  }
};
//
const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Message = mongoose.model('Message', messageSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);
const Story = mongoose.model('Story', storySchema);

// Helper function to create notifications
const createNotification = async (userId, senderId, type, message, postId = null) => {
  try {
    // Don't create notification if user is notifying themselves
    if (userId.toString() === senderId.toString()) {
      return;
    }

    // Check if similar notification already exists (to avoid spam)
    const existingNotification = await Notification.findOne({
      userId,
      senderId,
      type,
      postId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24 hours
    });

    if (existingNotification) {
      // Update the existing notification timestamp
      existingNotification.createdAt = new Date();
      existingNotification.isRead = false;
      await existingNotification.save();
      return existingNotification;
    }

    // Create new notification
    const notification = new Notification({
      userId,
      senderId,
      type,
      postId,
      message,
      isRead: false
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('🔐 Auth Debug:', {
      hasAuthHeader: !!authHeader,
      authHeaderValue: authHeader ? `${authHeader.substring(0, 20)}...` : 'none',
      hasToken: !!token,
      tokenLength: token ? token.length : 0
    });

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      console.log('❌ User not found for token');
      return res.status(401).json({ message: 'Invalid token' });
    }

    console.log('✅ Authentication successful for user:', user.username);
    req.user = user;
    next();
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};


// Helper function to upload image to Cloudinary
const uploadToCloudinary = (buffer, folder = 'instagram-clone') => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      reject(new Error('Cloudinary is not configured. Please set up your Cloudinary credentials.'));
      return;
    }

    cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: folder,
        transformation: [
          { width: 1080, height: 1080, crop: 'limit' },
          { quality: 'auto' },
          { format: 'jpg' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

// Helper function to upload story media to Cloudinary
const uploadStoryToCloudinary = (buffer, mediaType, folder = 'instagram-clone/stories') => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      reject(new Error('Cloudinary is not configured. Please set up your Cloudinary credentials.'));
      return;
    }

    const resourceType = mediaType === 'video' ? 'video' : 'image';
    const transformation = mediaType === 'video' 
      ? [
          { width: 1080, height: 1920, crop: 'limit' },
          { quality: 'auto' },
          { format: 'mp4' }
        ]
      : [
          { width: 1080, height: 1920, crop: 'limit' },
          { quality: 'auto' },
          { format: 'jpg' }
        ];

    cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: folder,
        transformation: transformation
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

// Helper function to create a placeholder image URL
const createPlaceholderImageUrl = () => {
  // Return a placeholder image service URL
  return `https://via.placeholder.com/1080x1080/e1e1e1/666666?text=Image+Upload+Disabled`;
};

// AUTHENTICATION ROUTES

// Register Route
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    // Validation
    if (!username || !email || !password || !fullName) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      fullName
    });

    await newUser.save();

    // Generate token
    const token = generateToken(newUser._id);

    // Return user data (without password) and token
    const userResponse = {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      fullName: newUser.fullName,
      profilePicture: newUser.profilePicture,
      bio: newUser.bio,
      followers: newUser.followers,
      following: newUser.following,
      posts: newUser.posts
    };

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without password) and token
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      profilePicture: user.profilePicture,
      bio: user.bio,
      followers: user.followers,
      following: user.following,
      posts: user.posts
    };

    res.json({
      message: 'Login successful',
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Get current user (protected route)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userResponse = {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      fullName: req.user.fullName,
      profilePicture: req.user.profilePicture,
      bio: req.user.bio,
      followers: req.user.followers,
      following: req.user.following,
      posts: req.user.posts
    };

    res.json({ user: userResponse });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// USER PROFILE ROUTES

// Get user profile by username or ID (protected route)
app.get('/api/users/:identifier', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Check if identifier is ObjectId or username
    let user;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      user = await User.findById(identifier)
        .populate('followers', 'username fullName profilePicture')
        .populate('following', 'username fullName profilePicture')
        .select('-password');
    } else {
      user = await User.findOne({ username: identifier })
        .populate('followers', 'username fullName profilePicture')
        .populate('following', 'username fullName profilePicture')
        .select('-password');
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's posts count
    const postsCount = await Post.countDocuments({ user: user._id });

    // Check if current user is following this user
    const isFollowing = user.followers.some(follower => 
      follower._id.toString() === req.user._id.toString()
    );

    const userProfile = {
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      profilePicture: user.profilePicture,
      bio: user.bio,
      postsCount,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      followers: user.followers,
      following: user.following,
      isFollowing,
      isOwnProfile: user._id.toString() === req.user._id.toString()
    };

    res.json({ user: userProfile });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error while fetching user profile' });
  }
});

// Update user profile (protected route)
app.put('/api/users/profile', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    const { fullName, bio } = req.body;
    const userId = req.user._id;

    // Validation
    if (bio && bio.length > 150) {
      return res.status(400).json({ message: 'Bio must be less than 150 characters' });
    }

    let updateData = {};
    
    if (fullName) updateData.fullName = fullName.trim();
    if (bio !== undefined) updateData.bio = bio.trim();

    // Handle profile picture upload
    if (req.file) {
      try {
        let profilePictureUrl;
        
        if (isCloudinaryConfigured()) {
          // Upload to Cloudinary with profile-specific transformations
          const cloudinaryResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              {
                resource_type: 'image',
                folder: 'instagram-clone/profiles',
                transformation: [
                  { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                  { quality: 'auto' },
                  { format: 'jpg' }
                ]
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            ).end(req.file.buffer);
          });
          
          profilePictureUrl = cloudinaryResult.secure_url;
          
          // Delete old profile picture if it exists and is from Cloudinary
          const oldUser = await User.findById(userId);
          if (oldUser.profilePicture && oldUser.profilePicture.includes('cloudinary')) {
            try {
              const publicId = oldUser.profilePicture.split('/').pop().split('.')[0];
              await cloudinary.uploader.destroy(`instagram-clone/profiles/${publicId}`);
            } catch (deleteError) {
              console.log('Could not delete old profile picture:', deleteError.message);
            }
          }
        } else {
          // Use placeholder if Cloudinary not configured
          profilePictureUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || req.user.fullName)}&size=400&background=0095f6&color=fff`;
        }
        
        updateData.profilePicture = profilePictureUrl;
      } catch (uploadError) {
        console.error('Profile picture upload error:', uploadError);
        return res.status(400).json({ message: 'Failed to upload profile picture' });
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture,
        bio: updatedUser.bio,
        followersCount: updatedUser.followers.length,
        followingCount: updatedUser.following.length
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
});

// Follow a user (protected route)
app.post('/api/users/:userId/follow', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Validation
    if (userId === currentUserId.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already following
    const currentUser = await User.findById(currentUserId);
    const isAlreadyFollowing = currentUser.following.includes(userId);

    if (isAlreadyFollowing) {
      return res.status(400).json({ message: 'You are already following this user' });
    }

    // Add to following and followers arrays
    await User.findByIdAndUpdate(currentUserId, {
      $push: { following: userId }
    });

    await User.findByIdAndUpdate(userId, {
      $push: { followers: currentUserId }
    });

    // Create notification for the followed user
    await createNotification(
      userId,
      currentUserId,
      'follow',
      `${req.user.username} started following you`
    );

    // Get updated counts
    const updatedCurrentUser = await User.findById(currentUserId).select('following');
    const updatedTargetUser = await User.findById(userId).select('followers');

    res.json({
      message: 'User followed successfully',
      isFollowing: true,
      followersCount: updatedTargetUser.followers.length,
      followingCount: updatedCurrentUser.following.length
    });

  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ message: 'Server error while following user' });
  }
});

// Unfollow a user (protected route)
app.delete('/api/users/:userId/follow', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Validation
    if (userId === currentUserId.toString()) {
      return res.status(400).json({ message: 'You cannot unfollow yourself' });
    }

    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if currently following
    const currentUser = await User.findById(currentUserId);
    const isFollowing = currentUser.following.includes(userId);

    if (!isFollowing) {
      return res.status(400).json({ message: 'You are not following this user' });
    }

    // Remove from following and followers arrays
    await User.findByIdAndUpdate(currentUserId, {
      $pull: { following: userId }
    });

    await User.findByIdAndUpdate(userId, {
      $pull: { followers: currentUserId }
    });

    // Get updated counts
    const updatedCurrentUser = await User.findById(currentUserId).select('following');
    const updatedTargetUser = await User.findById(userId).select('followers');

    res.json({
      message: 'User unfollowed successfully',
      isFollowing: false,
      followersCount: updatedTargetUser.followers.length,
      followingCount: updatedCurrentUser.following.length
    });

  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({ message: 'Server error while unfollowing user' });
  }
});

// Get user's followers (protected route)
app.get('/api/users/:userId/followers', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId)
      .populate({
        path: 'followers',
        select: 'username fullName profilePicture',
        options: {
          skip: skip,
          limit: limit
        }
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const totalFollowers = user.followers.length;
    const totalPages = Math.ceil(totalFollowers / limit);

    res.json({
      followers: user.followers,
      pagination: {
        currentPage: page,
        totalPages,
        totalFollowers,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ message: 'Server error while fetching followers' });
  }
});

// Get user's following (protected route)
app.get('/api/users/:userId/following', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId)
      .populate({
        path: 'following',
        select: 'username fullName profilePicture',
        options: {
          skip: skip,
          limit: limit
        }
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const totalFollowing = user.following.length;
    const totalPages = Math.ceil(totalFollowing / limit);

    res.json({
      following: user.following,
      pagination: {
        currentPage: page,
        totalPages,
        totalFollowing,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ message: 'Server error while fetching following' });
  }
});

// Search users (protected route)
app.get('/api/users/search/:query', authenticateToken, async (req, res) => {
  try {
    const { query } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { fullName: { $regex: query, $options: 'i' } }
      ]
    })
    .select('username fullName profilePicture')
    .limit(limit);

    res.json({ users });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error while searching users' });
  }
});

// POST ROUTES

// Create a new post (protected route)
app.post('/api/posts', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { caption, location, tags } = req.body;

    // Check if image is provided
    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }

    let imageUrl, cloudinaryId;

    try {
      if (isCloudinaryConfigured()) {
        // Upload image to Cloudinary
        const cloudinaryResult = await uploadToCloudinary(req.file.buffer);
        imageUrl = cloudinaryResult.secure_url;
        cloudinaryId = cloudinaryResult.public_id;
      } else {
        // Use placeholder image if Cloudinary is not configured
        imageUrl = createPlaceholderImageUrl();
        cloudinaryId = null;
        console.log('⚠️  Using placeholder image - Cloudinary not configured');
      }
    } catch (cloudinaryError) {
      console.error('Cloudinary upload error:', cloudinaryError);
      
      // Check if it's an API key error
      if (cloudinaryError.message && cloudinaryError.message.includes('api_key')) {
        return res.status(400).json({ 
          message: 'Image upload service not configured. Please contact administrator to set up Cloudinary credentials.',
          error: 'CLOUDINARY_NOT_CONFIGURED'
        });
      }
      
      // For other Cloudinary errors, use placeholder
      imageUrl = createPlaceholderImageUrl();
      cloudinaryId = null;
      console.log('⚠️  Using placeholder image due to upload error');
    }

    // Parse tags if provided
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (error) {
        parsedTags = [];
      }
    }

    // Create new post
    const newPost = new Post({
      user: req.user._id,
      caption: caption || '',
      imageUrl: imageUrl,
      cloudinaryId: cloudinaryId,
      location: location || '',
      tags: parsedTags || []
    });

    await newPost.save();

    // Add post to user's posts array
    await User.findByIdAndUpdate(req.user._id, {
      $push: { posts: newPost._id }
    });

    // Populate user data for response
    await newPost.populate('user', 'username fullName profilePicture');

    res.status(201).json({
      message: 'Post created successfully',
      post: newPost,
      warning: !isCloudinaryConfigured() ? 'Image upload service not configured - using placeholder' : null
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error during post creation' });
  }
});

// Get all posts for feed (protected route)
app.get('/api/posts/feed', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .populate('user', 'username fullName profilePicture')
      .populate('likes', 'username')
      .populate('comments.user', 'username fullName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments();
    const totalPages = Math.ceil(totalPosts / limit);

    res.json({
      posts,
      pagination: {
        currentPage: page,
        totalPages,
        totalPosts,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ message: 'Server error while fetching feed' });
  }
});

// Get a specific post by ID
app.get('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'username fullName profilePicture')
      .populate('likes', 'username')
      .populate('comments.user', 'username fullName profilePicture');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json({ post });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Server error while fetching post' });
  }
});

// Like/Unlike a post (protected route)
app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(postId).populate('user', 'username fullName');
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      // Unlike the post
      post.likes = post.likes.filter(id => !id.equals(userId));
    } else {
      // Like the post
      post.likes.push(userId);
      
      // Create notification for the post owner
      await createNotification(
        post.user._id,
        userId,
        'like',
        `${req.user.username} liked your post`,
        postId
      );
    }

    await post.save();

    // Populate likes for response
    await post.populate('likes', 'username');

    res.json({
      message: isLiked ? 'Post unliked' : 'Post liked',
      isLiked: !isLiked,
      likesCount: post.likes.length,
      likes: post.likes
    });

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Server error while liking post' });
  }
});

// Add comment to a post (protected route)
app.post('/api/posts/:id/comment', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    if (text.length > 500) {
      return res.status(400).json({ message: 'Comment must be less than 500 characters' });
    }

    const post = await Post.findById(postId).populate('user', 'username fullName');
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const newComment = {
      user: req.user._id,
      text: text.trim(),
      createdAt: new Date()
    };

    post.comments.push(newComment);
    await post.save();

    // Create notification for the post owner
    await createNotification(
      post.user._id,
      req.user._id,
      'comment',
      `${req.user.username} commented on your post`,
      postId
    );

    // Populate the new comment for response
    await post.populate('comments.user', 'username fullName profilePicture');

    const addedComment = post.comments[post.comments.length - 1];

    res.status(201).json({
      message: 'Comment added successfully',
      comment: addedComment,
      commentsCount: post.comments.length
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error while adding comment' });
  }
});

// Delete a post (protected route - only post owner can delete)
app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user owns the post
    if (!post.user.equals(userId)) {
      return res.status(403).json({ message: 'You can only delete your own posts' });
    }

    // Delete image from Cloudinary if it exists and Cloudinary is configured
    if (post.cloudinaryId && isCloudinaryConfigured()) {
      try {
        await cloudinary.uploader.destroy(post.cloudinaryId);
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
        // Continue with post deletion even if Cloudinary deletion fails
      }
    }

    // Remove post from user's posts array
    await User.findByIdAndUpdate(userId, {
      $pull: { posts: postId }
    });

    // Delete the post
    await Post.findByIdAndDelete(postId);

    res.json({ message: 'Post deleted successfully' });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error while deleting post' });
  }
});

// Get user's posts (protected route)
app.get('/api/posts/user/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ user: userId })
      .populate('user', 'username fullName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalPosts / limit);

    res.json({
      posts,
      pagination: {
        currentPage: page,
        totalPages,
        totalPosts,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ message: 'Server error while fetching user posts' });
  }
});

// Get explore posts (protected route) - trending/popular posts
app.get('/api/posts/explore', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get posts sorted by engagement (likes + comments count)
    const posts = await Post.aggregate([
      {
        $addFields: {
          likesCount: { $size: '$likes' },
          commentsCount: { $size: '$comments' },
          engagementScore: { 
            $add: [
              { $size: '$likes' }, 
              { $multiply: [{ $size: '$comments' }, 2] } // Comments weighted more
            ]
          }
        }
      },
      { $sort: { engagementScore: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { username: 1, fullName: 1, profilePicture: 1 } }]
        }
      },
      { $unwind: '$user' }
    ]);

    const totalPosts = await Post.countDocuments();
    const totalPages = Math.ceil(totalPosts / limit);

    res.json({
      posts,
      pagination: {
        currentPage: page,
        totalPages,
        totalPosts,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get explore posts error:', error);
    res.status(500).json({ message: 'Server error while fetching explore posts' });
  }
});

// NOTIFICATION ROUTES

// Get notifications for logged-in user (protected route)
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ userId: req.user._id })
      .populate('senderId', 'username fullName profilePicture')
      .populate('postId', 'imageUrl caption')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalNotifications = await Notification.countDocuments({ userId: req.user._id });
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    const totalPages = Math.ceil(totalNotifications / limit);

    res.json({
      notifications,
      unreadCount,
      pagination: {
        currentPage: page,
        totalPages,
        totalNotifications,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error while fetching notifications' });
  }
});

// Mark notification as read (protected route)
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    const notification = await Notification.findOne({
      _id: notificationId,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.isRead = true;
    await notification.save();

    res.json({ message: 'Notification marked as read' });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: 'Server error while marking notification as read' });
  }
});

// Mark all notifications as read (protected route)
app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({ message: 'All notifications marked as read' });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ message: 'Server error while marking all notifications as read' });
  }
});

// Delete notification (protected route)
app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error while deleting notification' });
  }
});

// MESSAGING ROUTES

// Send a message (protected route)
app.post('/api/messages', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const senderId = req.user._id;

    // Validation
    if (!receiverId) {
      return res.status(400).json({ message: 'Receiver ID is required' });
    }

    if (!text && !req.file) {
      return res.status(400).json({ message: 'Message text or image is required' });
    }

    if (text && text.length > 1000) {
      return res.status(400).json({ message: 'Message text must be less than 1000 characters' });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Handle image upload if provided
    let imageUrl = null;
    let cloudinaryId = null;

    if (req.file) {
      try {
        if (isCloudinaryConfigured()) {
          const cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'instagram-clone/messages');
          imageUrl = cloudinaryResult.secure_url;
          cloudinaryId = cloudinaryResult.public_id;
        } else {
          imageUrl = createPlaceholderImageUrl();
        }
      } catch (uploadError) {
        console.error('Message image upload error:', uploadError);
        return res.status(400).json({ message: 'Failed to upload image' });
      }
    }

    // Create new message
    const newMessage = new Message({
      senderId,
      receiverId,
      text: text || '',
      imageUrl,
      cloudinaryId
    });

    await newMessage.save();

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, receiverId],
        lastMessage: newMessage._id,
        lastMessageAt: new Date()
      });
    } else {
      conversation.lastMessage = newMessage._id;
      conversation.lastMessageAt = new Date();
    }

    await conversation.save();

    // Populate message for response
    await newMessage.populate('senderId', 'username fullName profilePicture');
    await newMessage.populate('receiverId', 'username fullName profilePicture');

    res.status(201).json({
      message: 'Message sent successfully',
      data: newMessage
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error while sending message' });
  }
});

// Get conversations for current user (protected route)
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const conversations = await Conversation.find({
      participants: userId
    })
    .populate('participants', 'username fullName profilePicture')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(limit);

    // Format conversations to show the other participant
    const formattedConversations = conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => 
        p._id.toString() !== userId.toString()
      );

      return {
        _id: conv._id,
        participant: otherParticipant,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        updatedAt: conv.updatedAt
      };
    });

    const totalConversations = await Conversation.countDocuments({
      participants: userId
    });
    const totalPages = Math.ceil(totalConversations / limit);

    res.json({
      conversations: formattedConversations,
      pagination: {
        currentPage: page,
        totalPages,
        totalConversations,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error while fetching conversations' });
  }
});

// Get messages between current user and another user (protected route)
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Check if other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get messages between the two users
    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    })
    .populate('senderId', 'username fullName profilePicture')
    .populate('receiverId', 'username fullName profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    // Mark messages as read (messages sent to current user)
    await Message.updateMany(
      {
        senderId: otherUserId,
        receiverId: currentUserId,
        isRead: false
      },
      { isRead: true }
    );

    const totalMessages = await Message.countDocuments({
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    });
    const totalPages = Math.ceil(totalMessages / limit);

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      otherUser: {
        id: otherUser._id,
        username: otherUser.username,
        fullName: otherUser.fullName,
        profilePicture: otherUser.profilePicture
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalMessages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error while fetching messages' });
  }
});

// Mark messages as read (protected route)
app.put('/api/messages/:userId/read', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;

    // Mark all unread messages from the other user as read
    const result = await Message.updateMany(
      {
        senderId: otherUserId,
        receiverId: currentUserId,
        isRead: false
      },
      { isRead: true }
    );

    res.json({
      message: 'Messages marked as read',
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({ message: 'Server error while marking messages as read' });
  }
});

// Get unread message count (protected route)
app.get('/api/messages/unread/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const unreadCount = await Message.countDocuments({
      receiverId: userId,
      isRead: false
    });

    res.json({ unreadCount });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error while fetching unread count' });
  }
});

// Delete a message (protected route - only sender can delete)
app.delete('/api/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender
    if (!message.senderId.equals(userId)) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    // Delete image from Cloudinary if it exists
    if (message.cloudinaryId && isCloudinaryConfigured()) {
      try {
        await cloudinary.uploader.destroy(message.cloudinaryId);
      } catch (error) {
        console.error('Error deleting message image from Cloudinary:', error);
      }
    }

    await Message.findByIdAndDelete(messageId);

    res.json({ message: 'Message deleted successfully' });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error while deleting message' });
  }
});

// ENHANCED STORY ROUTES WITH PROPER USER DATA HANDLING

// Create a new story (protected route)
app.post('/api/stories', authenticateToken, upload.single('media'), async (req, res) => {
  try {
    const { caption } = req.body;

    // Check if media is provided
    if (!req.file) {
      return res.status(400).json({ message: 'Media file is required' });
    }

    // Determine media type
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    
    let mediaUrl, cloudinaryId;

    try {
      if (isCloudinaryConfigured()) {
        // Upload media to Cloudinary
        const cloudinaryResult = await uploadStoryToCloudinary(req.file.buffer, mediaType);
        mediaUrl = cloudinaryResult.secure_url;
        cloudinaryId = cloudinaryResult.public_id;
      } else {
        // Use placeholder if Cloudinary is not configured
        mediaUrl = mediaType === 'video' 
          ? `https://via.placeholder.com/1080x1920/e1e1e1/666666?text=Video+Upload+Disabled`
          : `https://via.placeholder.com/1080x1920/e1e1e1/666666?text=Story+Upload+Disabled`;
        cloudinaryId = null;
        console.log('⚠️  Using placeholder media - Cloudinary not configured');
      }
    } catch (cloudinaryError) {
      console.error('Cloudinary story upload error:', cloudinaryError);
      
      // For Cloudinary errors, use placeholder
      mediaUrl = mediaType === 'video' 
        ? `https://via.placeholder.com/1080x1920/e1e1e1/666666?text=Video+Upload+Error`
        : `https://via.placeholder.com/1080x1920/e1e1e1/666666?text=Story+Upload+Error`;
      cloudinaryId = null;
      console.log('⚠️  Using placeholder media due to upload error');
    }

    // Create new story
    const newStory = new Story({
      userId: req.user._id,
      mediaUrl: mediaUrl,
      mediaType: mediaType,
      cloudinaryId: cloudinaryId,
      caption: caption || ''
    });

    await newStory.save();

    // Populate user data for response
    await newStory.populate('userId', 'username fullName profilePicture');

    res.status(201).json({
      message: 'Story created successfully',
      story: newStory,
      warning: !isCloudinaryConfigured() ? 'Media upload service not configured - using placeholder' : null
    });

  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ message: 'Server error during story creation' });
  }
});

// Get active stories with enhanced user data (protected route)
app.get('/api/stories', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Fetching stories for user:', req.user.username);
    
    // Clean up expired stories first
    await Story.cleanupExpiredStories();

    // Get active stories with detailed user information
    const stories = await Story.find({
      expiresAt: { $gt: new Date() },
      isActive: true
    })
    .populate({
      path: 'userId',
      select: 'username fullName profilePicture',
      model: 'User'
    })
    .populate({
      path: 'views.userId',
      select: 'username fullName profilePicture',
      model: 'User'
    })
    .sort({ createdAt: -1 });

    console.log(`✅ Found ${stories.length} active stories`);

    // Group stories by user and add view status
    const groupedStories = {};
    
    stories.forEach(story => {
      if (!story.userId) {
        console.warn('⚠️ Story found without valid user data:', story._id);
        return;
      }

      const userId = story.userId._id.toString();
      
      if (!groupedStories[userId]) {
        groupedStories[userId] = {
          _id: userId,
          user: {
            _id: story.userId._id,
            username: story.userId.username,
            fullName: story.userId.fullName,
            profilePicture: story.userId.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.userId.fullName || story.userId.username)}&size=400&background=0095f6&color=fff`
          },
          stories: [],
          hasViewed: false,
          latestStory: null
        };
      }

      // Check if current user has viewed this story
      const hasViewedThisStory = story.views.some(view => 
        view.userId && view.userId._id.toString() === req.user._id.toString()
      );

      // If any story in the group is viewed, mark the whole group as viewed
      if (hasViewedThisStory) {
        groupedStories[userId].hasViewed = true;
      }

      // Add story to the group
      groupedStories[userId].stories.push({
        _id: story._id,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        caption: story.caption,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        views: story.views,
        viewsCount: story.views.length
      });

      // Track the latest story for sorting
      if (!groupedStories[userId].latestStory || story.createdAt > groupedStories[userId].latestStory) {
        groupedStories[userId].latestStory = story.createdAt;
      }
    });

    // Convert to array and sort by latest story time
    const storiesArray = Object.values(groupedStories).sort((a, b) => 
      new Date(b.latestStory) - new Date(a.latestStory)
    );

    // Also provide a flat array for easier frontend consumption
    const flatStories = stories.map(story => ({
      _id: story._id,
      userId: story.userId ? {
        _id: story.userId._id,
        username: story.userId.username,
        fullName: story.userId.fullName,
        profilePicture: story.userId.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.userId.fullName || story.userId.username)}&size=400&background=0095f6&color=fff`
      } : null,
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType,
      caption: story.caption,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      views: story.views,
      viewsCount: story.views.length,
      hasViewed: story.views.some(view => 
        view.userId && view.userId._id.toString() === req.user._id.toString()
      )
    })).filter(story => story.userId !== null); // Filter out stories without valid user data

    console.log('📊 Stories response summary:', {
      totalGroupedUsers: storiesArray.length,
      totalFlatStories: flatStories.length,
      requestingUser: req.user.username
    });

    res.json({
      stories: storiesArray,           // Grouped by user (for story rings)
      flatStories: flatStories,       // Flat array (for story viewer)
      totalUsers: storiesArray.length,
      totalStories: flatStories.length
    });

  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ message: 'Server error while fetching stories' });
  }
});

// Get stories by user ID with enhanced data (protected route)
app.get('/api/stories/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('📥 Fetching stories for user ID:', userId);

    // Check if user exists and get user data
    const user = await User.findById(userId).select('username fullName profilePicture');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's active stories with populated user data
    const stories = await Story.find({
      userId: userId,
      expiresAt: { $gt: new Date() },
      isActive: true
    })
    .populate({
      path: 'userId',
      select: 'username fullName profilePicture',
      model: 'User'
    })
    .populate({
      path: 'views.userId',
      select: 'username fullName profilePicture',
      model: 'User'
    })
    .sort({ createdAt: 1 }); // Oldest first for viewing order

    // Format stories with enhanced user data
    const formattedStories = stories.map(story => ({
      _id: story._id,
      userId: {
        _id: story.userId._id,
        username: story.userId.username,
        fullName: story.userId.fullName,
        profilePicture: story.userId.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.userId.fullName || story.userId.username)}&size=400&background=0095f6&color=fff`
      },
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType,
      caption: story.caption,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      views: story.views,
      viewsCount: story.views.length,
      hasViewed: story.views.some(view => 
        view.userId && view.userId._id.toString() === req.user._id.toString()
      )
    }));

    console.log(`✅ Found ${formattedStories.length} stories for user: ${user.username}`);

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        profilePicture: user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&size=400&background=0095f6&color=fff`
      },
      stories: formattedStories,
      totalStories: formattedStories.length
    });

  } catch (error) {
    console.error('Get user stories error:', error);
    res.status(500).json({ message: 'Server error while fetching user stories' });
  }
});

// Add view to a story (protected route)
app.post('/api/stories/:storyId/view', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    console.log('👁️ Adding view to story:', storyId, 'by user:', req.user.username);

    const story = await Story.findById(storyId)
      .populate('userId', 'username fullName profilePicture');
    
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Check if story is still active
    if (story.expiresAt <= new Date() || !story.isActive) {
      return res.status(410).json({ message: 'Story has expired' });
    }

    // Add view (method handles duplicate checking)
    const viewsCount = await story.addView(userId);

    console.log('✅ Story view recorded. Total views:', viewsCount);

    res.json({
      message: 'Story view recorded',
      viewsCount: viewsCount
    });

  } catch (error) {
    console.error('Add story view error:', error);
    res.status(500).json({ message: 'Server error while recording story view' });
  }
});

// Get story views with enhanced user data (protected route - only story owner can see)
app.get('/api/stories/:storyId/views', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    const story = await Story.findById(storyId)
      .populate({
        path: 'views.userId',
        select: 'username fullName profilePicture',
        model: 'User'
      })
      .populate('userId', 'username fullName profilePicture');

    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Check if user owns the story
    if (!story.userId._id.equals(userId)) {
      return res.status(403).json({ message: 'You can only view your own story analytics' });
    }

    // Format views with enhanced user data
   // Format views with enhanced user data
// Format views with enhanced user data
const formattedViews = story.views.map(view => {
  const u = view.userId; // populated user object

  return {
    _id: view._id,
    userId: u?._id,
    username: u?.username || "Unknown",
    fullName: u?.fullName || "",
    profilePicture: u?.profilePicture || 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.fullName || u?.username || "User")}&size=400&background=0095f6&color=fff`,
    viewedAt: view.viewedAt
  };
}).sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt)); // Latest views first

    res.json({
      views: formattedViews,
      viewsCount: formattedViews.length,
      story: {
        _id: story._id,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        caption: story.caption,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt
      }
    });

  } catch (error) {
    console.error('Get story views error:', error);
    res.status(500).json({ message: 'Server error while fetching story views' });
  }
});

// Delete a story (protected route - only story owner can delete)
app.delete('/api/stories/:storyId', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Check if user owns the story
    if (!story.userId.equals(userId)) {
      return res.status(403).json({ message: 'You can only delete your own stories' });
    }

    // Delete media from Cloudinary if it exists and Cloudinary is configured
    if (story.cloudinaryId && isCloudinaryConfigured()) {
      try {
        await cloudinary.uploader.destroy(story.cloudinaryId, {
          resource_type: story.mediaType === 'video' ? 'video' : 'image'
        });
        console.log('✅ Story media deleted from Cloudinary');
      } catch (error) {
        console.error('Error deleting story media from Cloudinary:', error);
        // Continue with story deletion even if Cloudinary deletion fails
      }
    }

    // Delete the story
    await Story.findByIdAndDelete(storyId);

    console.log('✅ Story deleted successfully:', storyId);

    res.json({ message: 'Story deleted successfully' });

  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ message: 'Server error while deleting story' });
  }
});

// Get current user's own stories (protected route)
app.get('/api/stories/my-stories', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    console.log('📥 Fetching own stories for user:', req.user.username);

    // Get current user's active stories
    const stories = await Story.find({
      userId: userId,
      expiresAt: { $gt: new Date() },
      isActive: true
    })
    .populate({
      path: 'views.userId',
      select: 'username fullName profilePicture',
      model: 'User'
    })
    .sort({ createdAt: -1 }); // Latest first

    // Format stories with view details for owner
    const formattedStories = stories.map(story => ({
      _id: story._id,
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType,
      caption: story.caption,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      viewsCount: story.views.length,
      views: story.views.map(view => ({
        _id: view._id,
        user: {
          _id: view.userId._id,
          username: view.userId.username,
          fullName: view.userId.fullName,
          profilePicture: view.userId.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(view.userId.fullName || view.userId.username)}&size=400&background=0095f6&color=fff`
        },
        viewedAt: view.viewedAt
      })).sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))
    }));

    console.log(`✅ Found ${formattedStories.length} own stories`);

    res.json({
      user: {
        _id: req.user._id,
        username: req.user.username,
        fullName: req.user.fullName,
        profilePicture: req.user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.user.fullName || req.user.username)}&size=400&background=0095f6&color=fff`
      },
      stories: formattedStories,
      totalStories: formattedStories.length,
      totalViews: formattedStories.reduce((total, story) => total + story.viewsCount, 0)
    });

  } catch (error) {
    console.error('Get own stories error:', error);
    res.status(500).json({ message: 'Server error while fetching own stories' });
  }
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend server is running!',
    cloudinaryConfigured: isCloudinaryConfigured(),
    timestamp: new Date().toISOString()
  });
});

// Protected test route
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({
    message: 'This is a protected route!',
    user: req.user.username
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  if (err.message === 'Only image and video files are allowed!') {
    return res.status(400).json({ message: 'Only image and video files are allowed!' });
  }
  
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  Mongoose disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
});

// Auto-cleanup expired stories every hour
setInterval(async () => {
  try {
    console.log('🧹 Running scheduled story cleanup...');
    await Story.cleanupExpiredStories();
  } catch (error) {
    console.error('❌ Error during scheduled story cleanup:', error);
  }
}, 60 * 60 * 1000); // 1 hour

// Add this to your existing server.js file after the Story routes and before the test routes

// ==================== REELS ROUTES ====================
// Mount reels routes
app.use('/api/reels', reelsRoutes);
console.log('✅ Reels routes mounted at /api/reels');

// ==================== REELS ROUTES DEBUG - STEP BY STEP ====================
// Note: Debug routes are now handled by the modular reels router
// The following debug routes are kept for backward compatibility but should be removed in production

console.log('🔍 Debug routes available for reels...');

// First, let's make sure the Reel model exists
if (!Reel) {
  console.error('❌ CRITICAL: Reel model is not defined! Check if your Reel schema is properly defined.');
} else {
  console.log('✅ Reel model exists');
}

// Debug middleware to catch ALL requests
app.use('/api/reels*', (req, res, next) => {
  console.log('\n🚨 REELS ROUTE INTERCEPTED:');
  console.log(`   📍 Method: ${req.method}`);
  console.log(`   📍 Original URL: ${req.originalUrl}`);
  console.log(`   📍 Path: ${req.path}`);
  console.log(`   📍 Base URL: ${req.baseUrl}`);
  console.log(`   📍 Route: ${req.route ? req.route.path : 'No route matched yet'}`);
  console.log(`   📍 Params:`, req.params);
  console.log(`   📍 Query:`, req.query);
  console.log(`   📍 Headers:`, {
    'content-type': req.headers['content-type'],
    'authorization': req.headers['authorization'] ? 'Present' : 'Missing'
  });
  next();
});

// STEP 1: Simple test route (no auth, no middleware)
app.get('/api/reels/debug-simple', (req, res) => {
  console.log('🎯 SIMPLE DEBUG ROUTE HIT');
  res.json({ 
    success: true, 
    message: 'Simple route works!',
    timestamp: new Date().toISOString()
  });
});

// STEP 2: Test route with auth
app.get('/api/reels/debug-auth', authenticateToken, (req, res) => {
  console.log('🎯 AUTH DEBUG ROUTE HIT');
  console.log('🎯 User:', req.user ? req.user.username : 'No user');
  res.json({ 
    success: true, 
    message: 'Auth route works!',
    user: req.user ? req.user.username : null,
    timestamp: new Date().toISOString()
  });
});

// STEP 3: Test POST route with multer
app.post('/api/reels/debug-upload', authenticateToken, upload.single('video'), (req, res) => {
  console.log('🎯 UPLOAD DEBUG ROUTE HIT');
  console.log('🎯 User:', req.user ? req.user.username : 'No user');
  console.log('🎯 File:', req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  } : 'No file');
  console.log('🎯 Body:', req.body);
  
  res.json({ 
    success: true, 
    message: 'Upload debug route works!',
    hasFile: !!req.file,
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// STEP 4: Minimal working POST route for reels
app.post('/api/reels/debug-create', authenticateToken, upload.single('video'), async (req, res) => {
  console.log('🎯 ===== DEBUG CREATE REEL =====');
  console.log('🎯 User:', req.user ? req.user.username : 'No user');
  console.log('🎯 Body:', req.body);
  console.log('🎯 File:', req.file ? 'File present' : 'No file');

  try {
    // Check if Reel model works
    const testReel = new Reel({
      user: req.user._id,
      videoUrl: 'https://test.com/video.mp4',
      caption: 'Test reel',
      isActive: true
    });

    console.log('🎯 Test reel created in memory, attempting save...');
    await testReel.save();
    console.log('✅ Test reel saved successfully with ID:', testReel._id);

    // Clean up test reel
    await Reel.findByIdAndDelete(testReel._id);
    console.log('✅ Test reel cleaned up');

    res.json({
      success: true,
      message: 'Debug create route works - database connection OK',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug create error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug create failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// STEP 5: The actual working routes (simplified)


console.log('🔧 Main reels routes now handled by modular router...');

// Get all reels (simple version) - REPLACED BY MODULAR ROUTER

app.get('/api/reels', authenticateToken, async (req, res) => {
  console.log('🎬 ===== GET ALL REELS (MAIN ROUTE) =====');
  
  try {
    const reels = await Reel.find({ isActive: true })
      .populate('user', 'username fullName profilePicture')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    console.log(`🎬 Found ${reels.length} reels`);

    const reelsWithMetrics = reels.map(reel => ({
      _id: reel._id,
      user: reel.user,
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      caption: reel.caption,
      hashtags: reel.hashtags || [],
      likesCount: reel.likes?.length || 0,
      commentsCount: reel.comments?.length || 0,
      viewsCount: reel.views?.length || 0,
      createdAt: reel.createdAt
    }));

    res.json({
      success: true,
      reels: reelsWithMetrics,
      count: reelsWithMetrics.length
    });

  } catch (error) {
    console.error('❌ GET REELS ERROR:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching reels',
      error: error.message
    });
  }
});

// Create reel (simplified version)
app.post('/api/reels', authenticateToken, upload.single('video'), async (req, res) => {
  console.log('🎬 ===== CREATE REEL (MAIN ROUTE) =====');
  console.log('🎬 User:', req.user ? req.user.username : 'No user');
  console.log('🎬 Has file:', !!req.file);
  console.log('🎬 Body:', req.body);

  try {
    const { caption } = req.body;

    // For now, let's not require a file to test the route
    let videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    let thumbnailUrl = 'https://via.placeholder.com/400x600/e1e1e1/666666?text=Test+Reel';

    if (req.file && isCloudinaryConfigured()) {
      console.log('🎬 File provided and Cloudinary configured - would upload here');
      // Upload logic would go here
    }

    console.log('🎬 Creating reel in database...');
    const newReel = new Reel({
      user: req.user._id,
      videoUrl,
      thumbnailUrl,
      caption: caption || 'Test reel',
      hashtags: [],
      isActive: true
    });

    await newReel.save();
    console.log('✅ Reel created with ID:', newReel._id);

    // Add to user's reels
    await User.findByIdAndUpdate(req.user._id, {
      $push: { reels: newReel._id }
    });

    await newReel.populate('user', 'username fullName profilePicture');

    res.status(201).json({
      success: true,
      message: 'Reel created successfully',
      reel: {
        _id: newReel._id,
        user: newReel.user,
        videoUrl: newReel.videoUrl,
        thumbnailUrl: newReel.thumbnailUrl,
        caption: newReel.caption,
        createdAt: newReel.createdAt
      }
    });

  } catch (error) {
    console.error('❌ CREATE REEL ERROR:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating reel',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

//List all registered routes for debugging
app.get('/api/reels/debug-routes', (req, res) => {
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const path = middleware.route.path;
      const methods = Object.keys(middleware.route.methods);
      if (path.includes('/api/reels')) {
        routes.push({ path, methods });
      }
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const path = handler.route.path;
          const methods = Object.keys(handler.route.methods);
          if (path.includes('/api/reels')) {
            routes.push({ path, methods });
          }
        }
      });
    }
  });

  console.log('🔍 Registered reels routes:', routes);
  
  res.json({
    success: true,
    message: 'Debug routes info',
    registeredRoutes: routes,
    timestamp: new Date().toISOString()
  });
});

console.log('✅ Debug reels routes defined');

// Add a catch-all for any unmatched /api/reels routes
app.all('/api/reels/*', (req, res) => {
  console.log('🚨 UNMATCHED REELS ROUTE:', {
    method: req.method,
    url: req.originalUrl,
    path: req.path
  });
  
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /api/reels/debug-simple',
      'GET /api/reels/debug-auth', 
      'POST /api/reels/debug-upload',
      'POST /api/reels/debug-create',
      'GET /api/reels/debug-routes',
      'GET /api/reels',
      'POST /api/reels'
    ]
  });
});

// ==================== END DEBUG REELS ROUTES ====================
// ==================== END REELS ROUTES ====================
const PORT = process.env.PORT || 5000;


app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🔗 Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`📸 Post endpoints ready for image uploads`);
  console.log(`👤 Profile endpoints ready for user management`);
  console.log(`📱 Story endpoints ready with enhanced user data`);

  if (!isCloudinaryConfigured()) {
    console.log('\n⚠️  NOTICE: Cloudinary not configured');
    console.log('📝 To enable real image uploads:');
    console.log('   1. Sign up at https://cloudinary.com');
    console.log('   2. Get your credentials from the dashboard');
    console.log('   3. Update the .env file with your credentials');
    console.log('   4. Restart the server\n');
  }
});

// Connect to database (async, non-blocking)
connectDB();

module.exports = app;