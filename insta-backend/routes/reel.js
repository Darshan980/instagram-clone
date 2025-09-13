const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');

// Import models (adjust paths as needed)
const Reel = require('../schema/reel');
const User = require('../schema/user');

// Import middleware
const { authenticateToken } = require('../middleware/auth');

// Import utilities (adjust paths as needed)
const { 
  uploadToCloudinary, 
  uploadVideoToCloudinary,
  isCloudinaryConfigured, 
  generateVideoThumbnail,
  createPlaceholderUrl,
  cloudinary
} = require('../utils/cloudinary');

// Import notification schema directly for proper usage
const Notification = require('../schema/notification');

// Configure multer for video uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// Helper function to create notifications properly
const createNotificationHelper = async (userId, senderId, type, message, relatedId = null, relatedType = null) => {
  try {
    const notificationData = {
      userId,
      senderId,
      type,
      message
    };

    // Add optional fields based on type
    if (relatedId && relatedType === 'reel') {
      // For reels, we might need to map to postId if the notification schema expects it
      // or add support for reelId in the notification schema
      notificationData.metadata = { reelId: relatedId, relatedType };
    }

    return await Notification.createNotification(notificationData);
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// ==================== REELS ROUTES ====================

// Create a new reel with enhanced error handling
router.post('/', authenticateToken, upload.single('video'), async (req, res) => {
  console.log('🎬 Creating new reel...');
  console.log('Request body:', req.body);
  console.log('File info:', req.file ? { 
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size 
  } : 'No file');

  try {
    const { caption, hashtags, musicTrack } = req.body;

    // Validate video file
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'Video file is required for creating a reel',
        code: 'NO_VIDEO_FILE'
      });
    }

    if (!req.file.mimetype.startsWith('video/')) {
      return res.status(400).json({ 
        success: false,
        message: 'Only video files are allowed for reels',
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Validate file size (100MB max)
    if (req.file.size > 100 * 1024 * 1024) {
      return res.status(400).json({ 
        success: false,
        message: 'Video file size must be less than 100MB',
        code: 'FILE_TOO_LARGE'
      });
    }

    let videoUrl, thumbnailUrl, cloudinaryId, cloudinaryThumbnailId;
    let uploadWarning = null;

    try {
      if (isCloudinaryConfigured()) {
        console.log('📤 Uploading video to Cloudinary...');
        
        // Upload video to Cloudinary with correct parameters
        const cloudinaryResult = await uploadToCloudinary(
          req.file.buffer, 
          'instagram-clone/reels',
          {
            resourceType: 'video',
            mimetype: req.file.mimetype
          }
        );
        
        videoUrl = cloudinaryResult.secure_url;
        cloudinaryId = cloudinaryResult.public_id;
        
        // Generate thumbnail URL from Cloudinary video
        thumbnailUrl = cloudinary.url(cloudinaryResult.public_id, {
          resource_type: 'video',
          format: 'jpg',
          transformation: [
            { width: 400, height: 400, crop: 'fill' },
            { start_offset: '1' } // Extract frame at 1 second
          ]
        });
        
        console.log('✅ Video uploaded successfully to Cloudinary');
        console.log('Video URL:', videoUrl);
        console.log('Thumbnail URL:', thumbnailUrl);
        
      } else {
        console.log('⚠️  Cloudinary not configured, using placeholder');
        videoUrl = `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`;
        thumbnailUrl = createPlaceholderUrl('video', 'Reel Upload Disabled');
        cloudinaryId = null;
        uploadWarning = 'Video upload service not configured - using placeholder video';
      }
    } catch (uploadError) {
      console.error('❌ Video upload error:', uploadError);
      
      // Use placeholder on upload failure
      videoUrl = `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`;
      thumbnailUrl = createPlaceholderUrl('video', 'Upload Failed');
      cloudinaryId = null;
      uploadWarning = 'Video upload failed - using placeholder video';
    }

    // Parse hashtags
    let parsedHashtags = [];
    if (hashtags) {
      try {
        parsedHashtags = typeof hashtags === 'string' ? JSON.parse(hashtags) : hashtags;
        if (!Array.isArray(parsedHashtags)) parsedHashtags = [];
      } catch (error) {
        console.log('⚠️  Invalid hashtags format, ignoring');
        parsedHashtags = [];
      }
    }

    // Parse music track
    let parsedMusicTrack = null;
    if (musicTrack) {
      try {
        parsedMusicTrack = typeof musicTrack === 'string' ? JSON.parse(musicTrack) : musicTrack;
      } catch (error) {
        console.log('⚠️  Invalid music track format, ignoring');
        parsedMusicTrack = null;
      }
    }

    // Create new reel
    const newReel = new Reel({
      user: req.user._id,
      videoUrl,
      thumbnailUrl,
      cloudinaryId,
      cloudinaryThumbnailId,
      caption: caption?.trim() || '',
      hashtags: parsedHashtags,
      musicTrack: parsedMusicTrack,
      totalViews: 0, // FIXED: Initialize totalViews
      isActive: true
    });

    await newReel.save();

    // Add reel to user's reels array
    await User.findByIdAndUpdate(req.user._id, {
      $push: { reels: newReel._id }
    });

    // Populate user data for response
    await newReel.populate('user', 'username fullName profilePicture');

    const response = {
      success: true,
      message: 'Reel created successfully',
      reel: {
        _id: newReel._id,
        user: newReel.user,
        videoUrl: newReel.videoUrl,
        thumbnailUrl: newReel.thumbnailUrl,
        caption: newReel.caption,
        hashtags: newReel.hashtags,
        musicTrack: newReel.musicTrack,
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        shares: 0,
        createdAt: newReel.createdAt,
        isLikedByUser: false
      }
    };

    if (uploadWarning) {
      response.warning = uploadWarning;
    }

    console.log('✅ Reel created successfully:', newReel._id);
    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Create reel error:', error);
    
    let message = 'Server error during reel creation';
    let code = 'SERVER_ERROR';
    
    if (error.name === 'ValidationError') {
      message = 'Invalid reel data provided';
      code = 'VALIDATION_ERROR';
    }
    
    res.status(500).json({ 
      success: false,
      message,
      code,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// FIXED: Get reels feed with proper views count calculation
router.get('/feed', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 per request
    const skip = (page - 1) * limit;

    console.log(`📱 Fetching reels feed - Page: ${page}, Limit: ${limit}`);

    // FIXED: Get reels with populated data and proper view counts
    const reels = await Reel.find({ isActive: true })
      .populate('user', 'username fullName profilePicture')
      .populate('likes', 'username')
      .populate({
        path: 'comments.user',
        select: 'username fullName profilePicture'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean for better performance

    // FIXED: Add engagement metrics and user interaction status with proper view counts
    const reelsWithMetrics = reels.map(reel => ({
      _id: reel._id,
      user: {
        _id: reel.user._id,
        username: reel.user.username,
        fullName: reel.user.fullName,
        profilePicture: reel.user.profilePicture || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.user.fullName)}&size=150&background=0095f6&color=fff`
      },
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      caption: reel.caption,
      hashtags: reel.hashtags || [],
      musicTrack: reel.musicTrack,
      likesCount: reel.likes?.length || 0,
      commentsCount: reel.comments?.length || 0,
      viewsCount: reel.totalViews || reel.views?.length || 0, // FIXED: Use totalViews first
      shares: reel.shares || 0,
      duration: reel.duration,
      aspectRatio: reel.aspectRatio,
      createdAt: reel.createdAt,
      // Include comments with properly sized avatars
      comments: (reel.comments || []).map(comment => ({
        _id: comment._id,
        text: comment.text,
        createdAt: comment.createdAt,
        user: {
          _id: comment.user._id,
          username: comment.user.username,
          fullName: comment.user.fullName,
          profilePicture: comment.user.profilePicture || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.fullName || comment.user.username)}&size=64&background=0095f6&color=fff`
        }
      })),
      isLikedByUser: reel.likes?.some(like => 
        like._id.toString() === req.user._id.toString()
      ) || false
    }));

    // Get total count for pagination
    const totalReels = await Reel.countDocuments({ isActive: true });
    const totalPages = Math.ceil(totalReels / limit);

    console.log(`✅ Fetched ${reelsWithMetrics.length} reels successfully`);

    res.json({
      success: true,
      reels: reelsWithMetrics,
      pagination: {
        currentPage: page,
        totalPages,
        totalReels,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('❌ Get reels feed error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching reels feed',
      code: 'FETCH_REELS_ERROR'
    });
  }
});

// FIXED: Get specific reel by ID with proper view tracking
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const reelId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reel ID format',
        code: 'INVALID_REEL_ID'
      });
    }

    const reel = await Reel.findById(reelId)
      .populate('user', 'username fullName profilePicture')
      .populate('likes', 'username')
      .populate({
        path: 'comments.user',
        select: 'username fullName profilePicture'
      });

    if (!reel || !reel.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found or no longer available',
        code: 'REEL_NOT_FOUND'
      });
    }

    // FIXED: Add view and get updated count
    const updatedViewsCount = await reel.addView(req.user._id);
    console.log(`📊 View tracked for reel ${reelId}. Updated count: ${updatedViewsCount}`);

    const reelWithMetrics = {
      _id: reel._id,
      user: {
        _id: reel.user._id,
        username: reel.user.username,
        fullName: reel.user.fullName,
        profilePicture: reel.user.profilePicture || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.user.fullName)}&size=150&background=0095f6&color=fff`
      },
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      caption: reel.caption,
      hashtags: reel.hashtags || [],
      musicTrack: reel.musicTrack,
      likesCount: reel.likes.length,
      commentsCount: reel.comments.length,
      viewsCount: updatedViewsCount, // FIXED: Use the updated views count from addView
      shares: reel.shares,
      duration: reel.duration,
      aspectRatio: reel.aspectRatio,
      createdAt: reel.createdAt,
      updatedAt: reel.updatedAt,
      isLikedByUser: reel.likes.some(like => 
        like._id.toString() === req.user._id.toString()
      ),
      likes: reel.likes,
      comments: reel.comments.map(comment => ({
        _id: comment._id,
        text: comment.text,
        createdAt: comment.createdAt,
        user: {
          _id: comment.user._id,
          username: comment.user.username,
          fullName: comment.user.fullName,
          profilePicture: comment.user.profilePicture || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.fullName || comment.user.username)}&size=64&background=0095f6&color=fff`
        }
      })),
      isOwner: reel.user._id.toString() === req.user._id.toString()
    };

    res.json({ 
      success: true,
      reel: reelWithMetrics 
    });

  } catch (error) {
    console.error('❌ Get reel error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching reel',
      code: 'FETCH_REEL_ERROR'
    });
  }
});

// FIXED: Like/Unlike a reel with proper notification creation
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const reelId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reel ID format',
        code: 'INVALID_REEL_ID'
      });
    }

    const reel = await Reel.findById(reelId).populate('user', 'username fullName');
    
    if (!reel || !reel.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found',
        code: 'REEL_NOT_FOUND'
      });
    }

    const userId = req.user._id;
    const isLiked = reel.likes.includes(userId);

    if (isLiked) {
      // Unlike the reel
      reel.likes = reel.likes.filter(id => !id.equals(userId));
      console.log(`👎 User ${req.user.username} unliked reel ${reelId}`);
    } else {
      // Like the reel
      reel.likes.push(userId);
      console.log(`👍 User ${req.user.username} liked reel ${reelId}`);
      
      // Create notification for reel owner (FIXED: proper data object)
      if (reel.user._id.toString() !== userId.toString()) {
        try {
          await createNotificationHelper(
            reel.user._id,    // userId (recipient)
            userId,           // senderId (who liked)
            'like',           // type
            `${req.user.username} liked your reel`, // message
            reelId,           // relatedId
            'reel'            // relatedType
          );
          console.log('✅ Like notification created successfully');
        } catch (notificationError) {
          console.error('⚠️ Failed to create like notification:', notificationError);
          // Don't fail the like action if notification fails
        }
      }
    }

    await reel.save();

    res.json({
      success: true,
      message: isLiked ? 'Reel unliked successfully' : 'Reel liked successfully',
      isLiked: !isLiked,
      likesCount: reel.likes.length
    });

  } catch (error) {
    console.error('❌ Like reel error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while processing like',
      code: 'LIKE_REEL_ERROR'
    });
  }
});

// FIXED: Add comment to a reel with proper notification and avatar sizing
router.post('/:id/comment', authenticateToken, async (req, res) => {
  try {
    const reelId = req.params.id;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reel ID format',
        code: 'INVALID_REEL_ID'
      });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Comment text is required',
        code: 'MISSING_COMMENT_TEXT'
      });
    }

    if (text.length > 500) {
      return res.status(400).json({ 
        success: false,
        message: 'Comment must be less than 500 characters',
        code: 'COMMENT_TOO_LONG'
      });
    }

    const reel = await Reel.findById(reelId).populate('user', 'username fullName');
    
    if (!reel || !reel.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found',
        code: 'REEL_NOT_FOUND'
      });
    }

    const newComment = {
      user: req.user._id,
      text: text.trim(),
      createdAt: new Date()
    };

    reel.comments.push(newComment);
    await reel.save();

    // Create notification for reel owner (FIXED: proper data object)
    if (reel.user._id.toString() !== req.user._id.toString()) {
      try {
        await createNotificationHelper(
          reel.user._id,    // userId (recipient)
          req.user._id,     // senderId (who commented)
          'comment',        // type
          `${req.user.username} commented on your reel`, // message
          reelId,           // relatedId
          'reel'            // relatedType
        );
        console.log('✅ Comment notification created successfully');
      } catch (notificationError) {
        console.error('⚠️ Failed to create comment notification:', notificationError);
        // Don't fail the comment action if notification fails
      }
    }

    // Populate the new comment for response
    await reel.populate({
      path: 'comments.user',
      select: 'username fullName profilePicture'
    });

    const addedComment = reel.comments[reel.comments.length - 1];

    console.log(`💬 User ${req.user.username} commented on reel ${reelId}`);

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: {
        _id: addedComment._id,
        user: {
          _id: addedComment.user._id,
          username: addedComment.user.username,
          fullName: addedComment.user.fullName,
          // FIXED: Smaller avatar size for comments
          profilePicture: addedComment.user.profilePicture || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(addedComment.user.fullName)}&size=64&background=0095f6&color=fff`
        },
        text: addedComment.text,
        createdAt: addedComment.createdAt
      },
      commentsCount: reel.comments.length
    });

  } catch (error) {
    console.error('❌ Add reel comment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while adding comment',
      code: 'ADD_COMMENT_ERROR'
    });
  }
});

// FIXED: Get comments for a specific reel with proper avatar sizing
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const reelId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reel ID format',
        code: 'INVALID_REEL_ID'
      });
    }

    const reel = await Reel.findById(reelId)
      .populate({
        path: 'comments.user',
        select: 'username fullName profilePicture'
      })
      .select('comments');

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found',
        code: 'REEL_NOT_FOUND'
      });
    }

    // Sort comments by creation date (newest first) and paginate
    const sortedComments = reel.comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const startIndex = (page - 1) * limit;
    const paginatedComments = sortedComments.slice(startIndex, startIndex + limit);

    const formattedComments = paginatedComments.map(comment => ({
      _id: comment._id,
      user: {
        _id: comment.user._id,
        username: comment.user.username,
        fullName: comment.user.fullName,
        // FIXED: Smaller avatar size for comments
        profilePicture: comment.user.profilePicture || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.fullName || comment.user.username)}&size=64&background=0095f6&color=fff`
      },
      text: comment.text,
      createdAt: comment.createdAt
    }));

    const totalComments = reel.comments.length;
    const totalPages = Math.ceil(totalComments / limit);

    res.json({
      success: true,
      comments: formattedComments,
      pagination: {
        currentPage: page,
        totalPages,
        totalComments,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('❌ Get reel comments error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching comments',
      code: 'FETCH_COMMENTS_ERROR'
    });
  }
});

// Share a reel (increment share counter)
router.post('/:id/share', authenticateToken, async (req, res) => {
  try {
    const reelId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reel ID format',
        code: 'INVALID_REEL_ID'
      });
    }

    const reel = await Reel.findById(reelId);
    
    if (!reel || !reel.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found',
        code: 'REEL_NOT_FOUND'
      });
    }

    // Increment share count
    reel.shares = (reel.shares || 0) + 1;
    await reel.save();

    console.log(`📤 User ${req.user.username} shared reel ${reelId}`);

    res.json({
      success: true,
      message: 'Reel shared successfully',
      shares: reel.shares
    });

  } catch (error) {
    console.error('❌ Share reel error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while sharing reel',
      code: 'SHARE_REEL_ERROR'
    });
  }
});

// FIXED: Get user's reels with proper view counts and avatar sizing
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
        code: 'INVALID_USER_ID'
      });
    }

    // Check if user exists
    const user = await User.findById(userId).select('username fullName profilePicture');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const reels = await Reel.find({ user: userId, isActive: true })
      .populate('user', 'username fullName profilePicture')
      .populate({
        path: 'comments.user',
        select: 'username fullName profilePicture'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // FIXED: Add metrics for each reel with proper view counts
    const reelsWithMetrics = reels.map(reel => ({
      _id: reel._id,
      user: reel.user,
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      caption: reel.caption,
      hashtags: reel.hashtags || [],
      musicTrack: reel.musicTrack,
      likesCount: reel.likes?.length || 0,
      commentsCount: reel.comments?.length || 0,
      viewsCount: reel.totalViews || reel.views?.length || 0, // FIXED: Use totalViews first
      shares: reel.shares || 0,
      duration: reel.duration,
      aspectRatio: reel.aspectRatio,
      createdAt: reel.createdAt,
      comments: (reel.comments || []).map(comment => ({
        _id: comment._id,
        text: comment.text,
        createdAt: comment.createdAt,
        user: {
          _id: comment.user._id,
          username: comment.user.username,
          fullName: comment.user.fullName,
          // FIXED: Smaller avatar size for comments
          profilePicture: comment.user.profilePicture || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.fullName || comment.user.username)}&size=64&background=0095f6&color=fff`
        }
      })),
      isOwner: userId === req.user._id.toString()
    }));

    const totalReels = await Reel.countDocuments({ user: userId, isActive: true });
    const totalPages = Math.ceil(totalReels / limit);

    res.json({
      success: true,
      reels: reelsWithMetrics,
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        profilePicture: user.profilePicture
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalReels,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('❌ Get user reels error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching user reels',
      code: 'FETCH_USER_REELS_ERROR'
    });
  }
});

// Delete a reel (only owner can delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const reelId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reel ID format',
        code: 'INVALID_REEL_ID'
      });
    }

    const reel = await Reel.findById(reelId);
    
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found',
        code: 'REEL_NOT_FOUND'
      });
    }

    // Check if user owns the reel
    if (!reel.user.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own reels',
        code: 'UNAUTHORIZED_DELETE'
      });
    }

    // Delete video from Cloudinary if it exists
    if (reel.cloudinaryId && isCloudinaryConfigured()) {
      try {
        await cloudinary.uploader.destroy(reel.cloudinaryId, { 
          resource_type: 'video' 
        });
        console.log('✅ Reel video deleted from Cloudinary');
      } catch (deleteError) {
        console.error('⚠️  Error deleting reel video from Cloudinary:', deleteError);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }

    // Remove reel from user's reels array
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { reels: reelId }
    });

    // Delete the reel from database
    await Reel.findByIdAndDelete(reelId);

    console.log(`🗑️  User ${req.user.username} deleted reel ${reelId}`);

    res.json({
      success: true,
      message: 'Reel deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete reel error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting reel',
      code: 'DELETE_REEL_ERROR'
    });
  }
});

// FIXED: Search reels by hashtags with proper view counts
router.get('/search/:hashtag', authenticateToken, async (req, res) => {
  try {
    const { hashtag } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    if (!hashtag || hashtag.trim().length < 2) {
      return res.status(400).json({ 
        success: false,
        message: 'Hashtag must be at least 2 characters',
        code: 'INVALID_HASHTAG'
      });
    }

    const searchTerm = hashtag.replace('#', '').trim();

    const reels = await Reel.find({
      hashtags: { $regex: searchTerm, $options: 'i' },
      isActive: true
    })
    .populate('user', 'username fullName profilePicture')
    .populate({
      path: 'comments.user',
      select: 'username fullName profilePicture'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

    const reelsWithMetrics = reels.map(reel => ({
      _id: reel._id,
      user: reel.user,
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      caption: reel.caption,
      hashtags: reel.hashtags || [],
      musicTrack: reel.musicTrack,
      likesCount: reel.likes?.length || 0,
      commentsCount: reel.comments?.length || 0,
      viewsCount: reel.totalViews || reel.views?.length || 0, // FIXED: Use totalViews first
      shares: reel.shares || 0,
      duration: reel.duration,
      aspectRatio: reel.aspectRatio,
      createdAt: reel.createdAt,
      comments: (reel.comments || []).map(comment => ({
        _id: comment._id,
        text: comment.text,
        createdAt: comment.createdAt,
        user: {
          _id: comment.user._id,
          username: comment.user.username,
          fullName: comment.user.fullName,
          // FIXED: Smaller avatar size for comments
          profilePicture: comment.user.profilePicture || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.fullName || comment.user.username)}&size=64&background=0095f6&color=fff`
        }
      }))
    }));

    const totalReels = await Reel.countDocuments({
      hashtags: { $regex: searchTerm, $options: 'i' },
      isActive: true
    });
    const totalPages = Math.ceil(totalReels / limit);

    res.json({
      success: true,
      reels: reelsWithMetrics,
      searchTerm: searchTerm,
      hashtag: `#${searchTerm}`,
      pagination: {
        currentPage: page,
        totalPages,
        totalReels,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('❌ Search reels error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while searching reels',
      code: 'SEARCH_REELS_ERROR'
    });
  }
});

// FIXED: Get trending reels with proper view counts
router.get('/trending', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    // FIXED: Use the new getTrending static method from the schema
    const trendingReels = await Reel.getTrending(limit, 7);
    
    // Populate user data for the trending reels
    await Reel.populate(trendingReels, [
      { path: 'user', select: 'username fullName profilePicture' },
      { path: 'likes', select: 'username' },
      { path: 'comments.user', select: 'username fullName profilePicture' }
    ]);

    // Format the results
    const formattedReels = trendingReels.map(reel => ({
      _id: reel._id,
      user: {
        _id: reel.user._id,
        username: reel.user.username,
        fullName: reel.user.fullName,
        profilePicture: reel.user.profilePicture || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.user.fullName)}&size=150&background=0095f6&color=fff`
      },
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      caption: reel.caption,
      hashtags: reel.hashtags || [],
      musicTrack: reel.musicTrack,
      likesCount: reel.likesCount || 0,
      commentsCount: reel.commentsCount || 0,
      viewsCount: reel.viewsCount || 0, // This comes from the aggregation
      shares: reel.shares || 0,
      duration: reel.duration,
      aspectRatio: reel.aspectRatio,
      createdAt: reel.createdAt,
      engagementScore: reel.engagementScore,
      comments: (reel.comments || []).map(comment => ({
        _id: comment._id,
        text: comment.text,
        createdAt: comment.createdAt,
        user: {
          _id: comment.user._id,
          username: comment.user.username,
          fullName: comment.user.fullName,
          profilePicture: comment.user.profilePicture || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.fullName || comment.user.username)}&size=64&background=0095f6&color=fff`
        }
      }))
    }));

    const totalReels = await Reel.countDocuments({ isActive: true });
    const totalPages = Math.ceil(totalReels / limit);

    res.json({
      success: true,
      reels: formattedReels,
      pagination: {
        currentPage: page,
        totalPages,
        totalReels,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('❌ Get trending reels error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching trending reels',
      code: 'FETCH_TRENDING_REELS_ERROR'
    });
  }
});

// FIXED: Get reels by music track with proper view counts
router.get('/music/:trackId', authenticateToken, async (req, res) => {
  try {
    const { trackId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    if (!trackId || trackId.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Track ID is required',
        code: 'INVALID_TRACK_ID'
      });
    }

    const reels = await Reel.find({
      'musicTrack.name': { $regex: trackId, $options: 'i' },
      isActive: true
    })
    .populate('user', 'username fullName profilePicture')
    .populate({
      path: 'comments.user',
      select: 'username fullName profilePicture'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

    const reelsWithMetrics = reels.map(reel => ({
      _id: reel._id,
      user: reel.user,
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      caption: reel.caption,
      hashtags: reel.hashtags || [],
      musicTrack: reel.musicTrack,
      likesCount: reel.likes?.length || 0,
      commentsCount: reel.comments?.length || 0,
      viewsCount: reel.totalViews || reel.views?.length || 0, // FIXED: Use totalViews first
      shares: reel.shares || 0,
      duration: reel.duration,
      aspectRatio: reel.aspectRatio,
      createdAt: reel.createdAt,
      comments: (reel.comments || []).map(comment => ({
        _id: comment._id,
        text: comment.text,
        createdAt: comment.createdAt,
        user: {
          _id: comment.user._id,
          username: comment.user.username,
          fullName: comment.user.fullName,
          // FIXED: Smaller avatar size for comments
          profilePicture: comment.user.profilePicture || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.fullName || comment.user.username)}&size=64&background=0095f6&color=fff`
        }
      }))
    }));

    const totalReels = await Reel.countDocuments({
      'musicTrack.name': { $regex: trackId, $options: 'i' },
      isActive: true
    });
    const totalPages = Math.ceil(totalReels / limit);

    res.json({
      success: true,
      reels: reelsWithMetrics,
      trackId,
      pagination: {
        currentPage: page,
        totalPages,
        totalReels,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('❌ Get reels by music error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching reels by music',
      code: 'FETCH_MUSIC_REELS_ERROR'
    });
  }
});

// FIXED: Get reel analytics with proper view counts
router.get('/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const reelId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reel ID format',
        code: 'INVALID_REEL_ID'
      });
    }

    const reel = await Reel.findById(reelId)
      .populate('likes', 'username createdAt')
      .populate('views.user', 'username')
      .populate({
        path: 'comments.user',
        select: 'username'
      });

    if (!reel || !reel.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found',
        code: 'REEL_NOT_FOUND'
      });
    }

    // Check if user owns the reel
    if (!reel.user.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You can only view analytics for your own reels',
        code: 'UNAUTHORIZED_ANALYTICS'
      });
    }

    // FIXED: Calculate engagement metrics with proper view count
    const totalViews = reel.totalViews || reel.views?.length || 0;
    const totalLikes = reel.likes.length;
    const totalComments = reel.comments.length;
    const totalShares = reel.shares || 0;
    
    const engagementRate = totalViews > 0 ? 
      ((totalLikes + totalComments + totalShares) / totalViews * 100).toFixed(2) : 0;

    // Get view timeline (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentViews = reel.views ? reel.views.filter(view => 
      view.viewedAt >= thirtyDaysAgo
    ) : [];

    // Group views by day
    const viewsByDay = {};
    recentViews.forEach(view => {
      const day = view.viewedAt.toISOString().split('T')[0];
      viewsByDay[day] = (viewsByDay[day] || 0) + 1;
    });

    const analytics = {
      reelId: reel._id,
      metrics: {
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        engagementRate: parseFloat(engagementRate)
      },
      timeline: {
        viewsByDay,
        recentViewsCount: recentViews.length
      },
      demographics: {
        uniqueViewers: reel.getUniqueViewersCount(),
        repeatViewers: totalViews - reel.getUniqueViewersCount()
      },
      createdAt: reel.createdAt,
      lastUpdated: new Date()
    };

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('❌ Get reel analytics error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching reel analytics',
      code: 'FETCH_ANALYTICS_ERROR'
    });
  }
});

// Report a reel
router.post('/:id/report', authenticateToken, async (req, res) => {
  try {
    const reelId = req.params.id;
    const { reason, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reel ID format',
        code: 'INVALID_REEL_ID'
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Report reason is required',
        code: 'MISSING_REASON'
      });
    }

    const reel = await Reel.findById(reelId);
    
    if (!reel || !reel.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found',
        code: 'REEL_NOT_FOUND'
      });
    }

    // Here you would typically save the report to a reports collection
    // For now, we'll just log it
    console.log(`🚨 Reel ${reelId} reported by user ${req.user._id} for: ${reason}`);
    
    // You could create a Report model and save the report
    // const report = new Report({
    //   reporter: req.user._id,
    //   reportedContent: reelId,
    //   contentType: 'reel',
    //   reason: reason.trim(),
    //   description: description?.trim(),
    //   status: 'pending'
    // });
    // await report.save();

    res.json({
      success: true,
      message: 'Reel reported successfully. Our team will review it.'
    });

  } catch (error) {
    console.error('❌ Report reel error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while reporting reel',
      code: 'REPORT_REEL_ERROR'
    });
  }
});

// ADDED: Endpoint to manually track views (alternative approach)
router.post('/:id/view', authenticateToken, async (req, res) => {
  try {
    const reelId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(reelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reel ID format',
        code: 'INVALID_REEL_ID'
      });
    }

    const reel = await Reel.findById(reelId);
    
    if (!reel || !reel.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found',
        code: 'REEL_NOT_FOUND'
      });
    }

    const updatedViewsCount = await reel.addView(req.user._id);

    res.json({
      success: true,
      message: 'View tracked successfully',
      viewsCount: updatedViewsCount
    });

  } catch (error) {
    console.error('❌ Track view error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while tracking view',
      code: 'TRACK_VIEW_ERROR'
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Video file is too large. Maximum size is 100MB.',
        code: 'FILE_TOO_LARGE'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'File upload error',
      code: 'UPLOAD_ERROR',
      details: error.message
    });
  }
  
  if (error.message === 'Only video files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only video files are allowed for reels',
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  next(error);
});

module.exports = router;