const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken, optionalAuth } = require('../middleware/auth.js');
const { uploadToCloudinary, isCloudinaryConfigured, createPlaceholderImageUrl } = require('../utils/cloudinary.js');
const Notification = require('../schema/notification.js');

// Try alternative import methods for Post
let Post;
try {
  Post = require('../schema/post.js');
  console.log('Post import attempt 1:', typeof Post, Post);
} catch (error) {
  console.error('Error importing Post (attempt 1):', error);
}

// If that didn't work, try direct mongoose approach
if (!Post || typeof Post !== 'function') {
  try {
    const mongoose = require('mongoose');
    Post = mongoose.model('Post');
    console.log('Post import attempt 2 (mongoose.model):', typeof Post, Post);
  } catch (error) {
    console.error('Error importing Post (attempt 2):', error);
  }
}

const User = require('../schema/user.js');
const cloudinary = require('cloudinary').v2;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    console.log('File received - fieldname:', file.fieldname, 'mimetype:', file.mimetype);
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

// Debug middleware
router.use((req, res, next) => {
  console.log(`POST ROUTE: ${req.method} ${req.path} - Params:`, req.params);
  next();
});

// Helper function to format post data for frontend compatibility
const formatPostForResponse = (post) => {
  if (!post) return null;
  
  const postObj = post.toObject ? post.toObject() : post;
  
  return {
    ...postObj,
    id: postObj._id.toString(),
    _id: postObj._id,
    likesCount: postObj.likes ? postObj.likes.length : 0,
    commentsCount: postObj.comments ? postObj.comments.length : 0,
    isLiked: false, // This will be set properly in the route handlers
    // Add media array for frontend compatibility if using single image schema
    media: postObj.imageUrl ? [{
      url: postObj.imageUrl,
      publicId: postObj.cloudinaryId,
      type: 'image'
    }] : []
  };
};

// Create new post - use upload.any() to accept any field names
router.post('/', authenticateToken, upload.any(), async (req, res) => {
  try {
    console.log('📝 Creating new post...');
    console.log('User:', req.user.username);
    console.log('Body:', req.body);
    console.log('Files:', req.files ? req.files.length : 0);
    console.log('File field names:', req.files ? req.files.map(f => f.fieldname) : []);

    const { caption, location, tags } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'At least one media file is required' 
      });
    }

    if (caption && caption.length > 2200) {
      return res.status(400).json({ 
        success: false,
        message: 'Caption must be less than 2200 characters' 
      });
    }

    // Process media files (adapted for single image schema)
    let imageUrl = '';
    let cloudinaryId = '';
    
    if (req.files && req.files.length > 0) {
      const file = req.files[0]; // Take only the first file since schema expects single image
      try {
        if (isCloudinaryConfigured()) {
          const cloudinaryResult = await uploadToCloudinary(file.buffer);
          imageUrl = cloudinaryResult.secure_url;
          cloudinaryId = cloudinaryResult.public_id;
        } else {
          // Use placeholder if Cloudinary not configured
          imageUrl = createPlaceholderImageUrl();
          cloudinaryId = '';
          console.log('⚠️  Using placeholder image - Cloudinary not configured');
        }
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(400).json({ 
          success: false,
          message: 'Failed to upload image',
          error: uploadError.message 
        });
      }
    }

    // Process tags
    let processedTags = [];
    if (tags) {
      if (Array.isArray(tags)) {
        processedTags = tags;
      } else if (typeof tags === 'string') {
        processedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }

    // Debug the Post constructor
    console.log('About to create Post. Post constructor:', Post);
    console.log('Is Post a function?', typeof Post === 'function');
    
    // Safety check
    if (!Post || typeof Post !== 'function') {
      return res.status(500).json({
        success: false,
        message: 'Post model not properly loaded',
        debug: {
          postType: typeof Post,
          postValue: Post
        }
      });
    }
    
    // Create post (adapted for your schema)
    const newPost = new Post({
      user: userId,
      caption: caption ? caption.trim() : '',
      imageUrl: imageUrl,
      cloudinaryId: cloudinaryId,
      location: location ? location.trim() : '',
      tags: processedTags,
      likes: [],
      comments: []
    });

    const savedPost = await newPost.save();

    // Update user's posts count
    await User.findByIdAndUpdate(userId, {
      $inc: { postsCount: 1 }
    });

    // Populate user data for response
    const populatedPost = await Post.findById(savedPost._id)
      .populate('user', 'username fullName profilePicture')
      .populate('comments.user', 'username fullName profilePicture');

    const formattedPost = formatPostForResponse(populatedPost);

    console.log('✅ Post created successfully:', formattedPost.id);

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: formattedPost
    });

  } catch (error) {
    console.error('Create post error:', error);
    
    // Handle multer errors specifically
    if (error.code === 'UNEXPECTED_FIELD') {
      return res.status(400).json({
        success: false,
        message: 'Invalid file field name. Expected "media"',
        error: error.message
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Server error while creating post',
      error: error.message 
    });
  }
});

// IMPORTANT: Put specific routes BEFORE parameterized routes
// Get feed posts
router.get('/feed', authenticateToken, async (req, res) => {
  try {
    console.log('📰 Fetching feed for user:', req.user.username);
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get user's following list
    const currentUser = await User.findById(req.user._id).select('following');
    const followingIds = currentUser.following || [];

    // Include user's own posts in feed
    const userIds = [req.user._id, ...followingIds];

    // Fetch posts from followed users and own posts
    const posts = await Post.find({ user: { $in: userIds } })
      .populate('user', 'username fullName profilePicture')
      .populate('comments.user', 'username fullName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Format posts and add like status for current user
    const formattedPosts = posts.map(post => {
      const formatted = formatPostForResponse(post);
      formatted.isLiked = post.likes.includes(req.user._id);
      return formatted;
    });

    console.log(`✅ Found ${formattedPosts.length} posts for feed`);

    res.json({
      success: true,
      data: {
        posts: formattedPosts,
        pagination: {
          currentPage: page,
          hasNextPage: posts.length === limit,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching feed' 
    });
  }
});

// Get explore posts
router.get('/explore', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Fetching explore posts for user:', req.user.username);
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get posts from users not followed by current user
    const currentUser = await User.findById(req.user._id).select('following');
    const followingIds = currentUser.following || [];
    const excludeUserIds = [req.user._id, ...followingIds];

    const posts = await Post.find({ 
      user: { $nin: excludeUserIds } 
    })
    .populate('user', 'username fullName profilePicture')
    .sort({ createdAt: -1, likesCount: -1 }) // Sort by recent and popular
    .skip(skip)
    .limit(limit);

    const formattedPosts = posts.map(post => {
      const formatted = formatPostForResponse(post);
      formatted.isLiked = post.likes.includes(req.user._id);
      return formatted;
    });

    console.log(`✅ Found ${formattedPosts.length} explore posts`);

    res.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        currentPage: page,
        hasNextPage: posts.length === limit,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get explore posts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching explore posts' 
    });
  }
});

// Get user's posts
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('👤 Fetching posts for user:', userId);
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const posts = await Post.find({ user: userId })
      .populate('user', 'username fullName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formattedPosts = posts.map(post => {
      const formatted = formatPostForResponse(post);
      formatted.isLiked = post.likes.includes(req.user._id);
      return formatted;
    });

    console.log(`✅ Found ${formattedPosts.length} posts for user ${userId}`);

    res.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        currentPage: page,
        hasNextPage: posts.length === limit,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching user posts' 
    });
  }
});

// Like/Unlike post (specific route before /:id)
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    console.log('❤️ Toggling like for post:', id, 'by user:', req.user.username);

    const post = await Post.findById(id).populate('user', 'username _id');
    if (!post) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found' 
      });
    }

    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      // Unlike
      post.likes.pull(userId);
      console.log('👎 Unliked post');
    } else {
      // Like
      post.likes.push(userId);
      console.log('👍 Liked post');

      // Create notification for post owner (fixed with proper null checks)
      if (post.user && post.user._id && post.user._id.toString() !== userId.toString()) {
        try {
          await Notification.createNotification({
            userId: post.user._id,
            senderId: userId,
            type: 'like',
            postId: post._id,
            message: `${req.user.username} liked your post`
          });
        } catch (notifError) {
          console.error('Failed to create like notification:', notifError);
        }
      }
    }

    await post.save();
    console.log('✅ Like operation completed successfully');

    res.json({
      success: true,
      message: isLiked ? 'Post unliked' : 'Post liked',
      data: {
        isLiked: !isLiked,
        likesCount: post.likes.length,
        likes: post.likes
      }
    });

  } catch (error) {
    console.error('❌ Like post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while liking post',
      error: error.message 
    });
  }
});

// Add comment to post (specific route before /:id)
router.post('/:id/comment', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    console.log('💬 Adding comment to post:', id, 'by user:', req.user.username);
    console.log('Comment text:', text);

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Comment text is required' 
      });
    }

    if (text.length > 500) {
      return res.status(400).json({ 
        success: false,
        message: 'Comment must be less than 500 characters' 
      });
    }

    const post = await Post.findById(id).populate('user', 'username _id');
    if (!post) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found' 
      });
    }

    const newComment = {
      user: userId,
      text: text.trim(),
      createdAt: new Date()
    };

    post.comments.push(newComment);
    await post.save();

    // Create notification for post owner (fixed with proper null checks)
    if (post.user && post.user._id && post.user._id.toString() !== userId.toString()) {
      try {
        await Notification.createNotification({
          userId: post.user._id,
          senderId: userId,
          type: 'comment',
          postId: post._id,
          message: `${req.user.username} commented on your post`
        });
      } catch (notifError) {
        console.error('Failed to create comment notification:', notifError);
      }
    }

    // Get the saved comment with user data
    const updatedPost = await Post.findById(id)
      .populate('comments.user', 'username fullName profilePicture');

    const addedComment = updatedPost.comments[updatedPost.comments.length - 1];

    console.log('✅ Comment added successfully');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comment: addedComment,
        commentsCount: updatedPost.comments.length
      }
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while adding comment' 
    });
  }
});

// Get post comments
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    console.log('💬 Fetching comments for post:', id);

    const post = await Post.findById(id)
      .populate('comments.user', 'username fullName profilePicture')
      .select('comments');

    if (!post) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found' 
      });
    }

    // Sort comments by creation date (newest first)
    const sortedComments = post.comments.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Implement pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedComments = sortedComments.slice(startIndex, endIndex);

    console.log(`✅ Found ${paginatedComments.length} comments for post ${id}`);

    res.json({
      success: true,
      comments: paginatedComments,
      pagination: {
        currentPage: page,
        totalComments: sortedComments.length,
        hasNextPage: endIndex < sortedComments.length,
        hasPrevPage: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching comments' 
    });
  }
});

// Get single post by ID (MUST come after all specific routes)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📄 Fetching post:', id);

    const post = await Post.findById(id)
      .populate('user', 'username fullName profilePicture')
      .populate('comments.user', 'username fullName profilePicture');

    if (!post) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found' 
      });
    }

    const formattedPost = formatPostForResponse(post);
    formattedPost.isLiked = post.likes.includes(req.user._id);

    console.log('✅ Post found:', formattedPost.id);

    res.json({
      success: true,
      post: formattedPost
    });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching post' 
    });
  }
});

// Delete post
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    console.log('🗑️ Deleting post:', id, 'by user:', req.user.username);

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found' 
      });
    }

    // Check if user owns the post
    if (post.user.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false,
        message: 'You can only delete your own posts' 
      });
    }

    // Delete image from Cloudinary if configured
    if (isCloudinaryConfigured() && post.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(post.cloudinaryId);
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
      }
    }

    await Post.findByIdAndDelete(id);

    // Update user's posts count
    await User.findByIdAndUpdate(userId, {
      $inc: { postsCount: -1 }
    });

    console.log('✅ Post deleted successfully');

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting post' 
    });
  }
});

module.exports = router;