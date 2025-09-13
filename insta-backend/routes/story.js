const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth.js');
const Story = require('../schema/story.js');
const User = require('../schema/user.js');

// Configure multer for memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// Helper functions for Cloudinary (with fallbacks)
const getCloudinaryUtils = () => {
  try {
    return require('../utils/cloudinary');
  } catch (error) {
    console.log('Cloudinary utilities not available');
    return {
      isCloudinaryConfigured: () => false,
      cloudinary: null
    };
  }
};

// Helper function to check if Cloudinary is configured
const isCloudinaryConfigured = () => {
  const cloudinaryUtils = getCloudinaryUtils();
  return cloudinaryUtils.isCloudinaryConfigured();
};

// Helper function to upload story to Cloudinary
const uploadStoryToCloudinary = async (fileBuffer, mediaType) => {
  const cloudinaryUtils = getCloudinaryUtils();
  
  if (!cloudinaryUtils.isCloudinaryConfigured()) {
    throw new Error('Cloudinary not configured');
  }

  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: 'instagram-clone/stories',
      resource_type: mediaType === 'video' ? 'video' : 'image',
      transformation: mediaType === 'video' ? [
        { width: 1080, height: 1920, crop: 'fill', quality: 'auto' }
      ] : [
        { width: 1080, height: 1920, crop: 'fill', quality: 'auto', format: 'jpg' }
      ]
    };

    const uploadStream = cloudinaryUtils.cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
};

// Create a new story (protected route)
router.post('/', authenticateToken, upload.single('media'), async (req, res) => {
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
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Fetching stories for user:', req.user.username);
    
    // Clean up expired stories first (with error handling)
    try {
      await Story.cleanupExpiredStories();
    } catch (cleanupError) {
      console.error('Story cleanup failed:', cleanupError);
      // Continue with fetching stories even if cleanup fails
    }

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

// Get current user's own stories (protected route)
router.get('/my-stories', authenticateToken, async (req, res) => {
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

// Get stories by user ID with enhanced data (protected route)
router.get('/user/:userId', authenticateToken, async (req, res) => {
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

// Get single story by ID (protected route)
router.get('/:storyId', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findById(storyId)
      .populate('userId', 'username fullName profilePicture')
      .populate({
        path: 'views.userId',
        select: 'username fullName profilePicture',
        model: 'User'
      });

    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Check if story is still active
    if (story.expiresAt <= new Date() || !story.isActive) {
      return res.status(410).json({ message: 'Story has expired' });
    }

    // Format story with user data
    const formattedStory = {
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
    };

    res.json({
      story: formattedStory
    });

  } catch (error) {
    console.error('Get single story error:', error);
    res.status(500).json({ message: 'Server error while fetching story' });
  }
});

// Add view to a story (protected route)
router.post('/:storyId/view', authenticateToken, async (req, res) => {
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
router.get('/:storyId/views', authenticateToken, async (req, res) => {
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
router.delete('/:storyId', authenticateToken, async (req, res) => {
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
        const cloudinaryUtils = getCloudinaryUtils();
        await cloudinaryUtils.cloudinary.uploader.destroy(story.cloudinaryId, {
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

// Error handling middleware for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  if (err.message === 'Only image and video files are allowed!') {
    return res.status(400).json({ message: 'Only image and video files are allowed!' });
  }
  
  next(err);
});

module.exports = router;