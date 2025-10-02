const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth.js');
const User = require('../schema/user.js');
const { createNotification } = require('../schema/notification.js');

const router = express.Router();

// ============================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ============================

// Ensure upload directory exists
const uploadDir = 'uploads/profiles';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// ============================
// SEARCH ROUTES
// ============================

// Search route - BEFORE /:identifier
router.get('/search/:query', authenticateToken, async (req, res) => {
  try {
    const query = req.params.query.trim();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log('🔍 Search request received:', query);

    if (!query || query.length < 1) {
      return res.status(400).json({
        success: false,
        error: 'Search query cannot be empty'
      });
    }

    let users = [];
    let totalUsers = 0;

    // For short/generic queries, show suggestions
    if (query.length === 1 || ['user', 'photo', 'gram', 'pic', 'a', 'e', 'i'].includes(query.toLowerCase())) {
      const currentUser = await User.findById(req.user._id).select('following');
      const followingIds = currentUser.following || [];
      const excludeIds = [...followingIds, req.user._id];
      
      totalUsers = await User.countDocuments({
        _id: { $nin: excludeIds },
        isActive: { $ne: false }
      });

      users = await User.find({
        _id: { $nin: excludeIds },
        isActive: { $ne: false }
      })
      .select('username fullName profilePicture bio followers following createdAt')
      .sort({ createdAt: -1, followers: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    } else {
      // Normal search
      const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const currentUser = await User.findById(req.user._id).select('following');
      const followingIds = currentUser.following || [];
      
      const searchCriteria = {
        $and: [
          {
            $or: [
              { username: searchRegex },
              { fullName: searchRegex }
            ]
          },
          { _id: { $ne: req.user._id } },
          { isActive: { $ne: false } }
        ]
      };
      
      totalUsers = await User.countDocuments(searchCriteria);

      users = await User.find(searchCriteria)
      .select('username fullName profilePicture bio followers following createdAt')
      .skip(skip)
      .limit(limit)
      .sort({ followers: -1, createdAt: -1 })
      .lean();
    }

    const totalPages = Math.ceil(totalUsers / limit);
    const currentUser = await User.findById(req.user._id).select('following');
    const followingIds = (currentUser.following || []).map(id => id.toString());

    const usersWithInfo = users.map(user => ({
      ...user,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0,
      isFollowing: followingIds.includes(user._id.toString()),
      daysSinceJoined: user.createdAt ? Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)) : 0
    }));

    res.json({
      success: true,
      data: {
        users: usersWithInfo,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit
        },
        query: query,
        searchType: query.length === 1 ? 'suggestions' : 'search'
      }
    });

  } catch (error) {
    console.error('❌ Search users error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while searching users'
    });
  }
});

// Suggestions endpoint - BEFORE /:identifier
router.get('/suggestions', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    console.log('💡 Getting user suggestions');

    const currentUser = await User.findById(req.user._id).select('following followers');
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: 'Current user not found'
      });
    }

    const followingIds = currentUser.following || [];
    const followerIds = currentUser.followers || [];
    const excludeIds = [...followingIds, req.user._id];

    let suggestedUsers = [];
    
    if (followerIds.length > 0) {
      try {
        suggestedUsers = await User.aggregate([
          {
            $match: {
              followers: { $in: followerIds },
              _id: { $nin: excludeIds },
              isActive: { $ne: false }
            }
          },
          {
            $addFields: {
              mutualFollowersCount: {
                $size: {
                  $setIntersection: ['$followers', followerIds]
                }
              }
            }
          },
          {
            $sort: {
              mutualFollowersCount: -1,
              followers: -1,
              createdAt: -1
            }
          },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              username: 1,
              fullName: 1,
              profilePicture: 1,
              bio: 1,
              followers: 1,
              following: 1,
              createdAt: 1,
              mutualFollowersCount: 1
            }
          }
        ]);
      } catch (aggregationError) {
        console.error('Aggregation error:', aggregationError);
        suggestedUsers = [];
      }
    }

    if (suggestedUsers.length < limit) {
      const remainingLimit = limit - suggestedUsers.length;
      const existingSuggestionIds = suggestedUsers.map(u => u._id);
      
      const additionalUsers = await User.find({
        _id: { $nin: [...excludeIds, ...existingSuggestionIds] },
        isActive: { $ne: false }
      })
      .select('username fullName profilePicture bio followers following createdAt')
      .sort({ createdAt: -1, followers: -1 })
      .limit(remainingLimit)
      .lean();

      const additionalUsersWithMutual = additionalUsers.map(user => ({
        ...user,
        mutualFollowersCount: 0
      }));

      suggestedUsers = [...suggestedUsers, ...additionalUsersWithMutual];
    }

    const suggestionsWithInfo = suggestedUsers.map(user => ({
      ...user,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0,
      isFollowing: false,
      suggestionReason: user.mutualFollowersCount > 0 
        ? `${user.mutualFollowersCount} mutual connection${user.mutualFollowersCount > 1 ? 's' : ''}`
        : 'Suggested for you'
    }));

    res.json({
      success: true,
      data: {
        users: suggestionsWithInfo,
        totalSuggestions: suggestionsWithInfo.length,
        hasMore: suggestionsWithInfo.length === limit,
        page: page
      }
    });

  } catch (error) {
    console.error('❌ Get suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while getting suggestions',
      data: {
        users: [],
        totalSuggestions: 0,
        hasMore: false,
        page: 1
      }
    });
  }
});

// ============================
// PROFILE UPDATE ROUTE - WITH FILE UPLOAD SUPPORT
// ============================

router.put('/profile', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    const { fullName, bio } = req.body;
    const userId = req.user._id;

    console.log('=== PROFILE UPDATE REQUEST ===');
    console.log('User ID:', userId);
    console.log('Full Name:', fullName);
    console.log('Bio:', bio);
    console.log('Bio Length:', bio?.length || 0);
    console.log('File uploaded:', !!req.file);

    const updateData = {};
    
    // Validate and update fullName
    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || fullName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Full name is required'
        });
      }
      if (fullName.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Full name must be less than 50 characters'
        });
      }
      updateData.fullName = fullName.trim();
    }

    // Validate and update bio - CRITICAL: Handle empty bio properly
    if (bio !== undefined) {
      if (typeof bio !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Bio must be a string'
        });
      }
      if (bio.length > 150) {
        return res.status(400).json({
          success: false,
          error: 'Bio must be less than 150 characters'
        });
      }
      // CRITICAL: Allow empty bio, just trim it
      updateData.bio = bio.trim();
    }

    // Handle profile picture upload
    if (req.file) {
      // Generate URL for the uploaded file
      updateData.profilePicture = `/uploads/profiles/${req.file.filename}`;
      console.log('Profile picture URL:', updateData.profilePicture);
    }

    console.log('Update data being saved:', updateData);

    // Update the user and return the complete updated document
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { 
        new: true,
        runValidators: true
      }
    ).select('-password -emailVerificationToken -emailVerificationExpires -lockedUntil -loginAttempts');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log('User updated in database:', {
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      bio: updatedUser.bio,
      bioLength: updatedUser.bio?.length || 0,
      profilePicture: updatedUser.profilePicture
    });

    // CRITICAL: Return the user data in the expected format
    const response = {
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser.toObject()
    };

    console.log('=== PROFILE UPDATE SUCCESS ===');

    res.json(response);

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File size too large. Maximum 5MB allowed.'
        });
      }
      return res.status(400).json({
        success: false,
        error: 'File upload error: ' + error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error while updating profile'
    });
  }
});

// ============================
// GET USER PROFILE
// ============================

router.get('/:identifier', authenticateToken, async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const currentUserId = req.user._id;
    let query = {};

    console.log('👤 Getting profile for:', identifier);

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      query._id = identifier;
    } else {
      query.username = identifier.toLowerCase();
    }

    const user = await User.findOne(query)
      .select('-password -emailVerificationToken -emailVerificationExpires -lockedUntil -loginAttempts')
      .populate('followers', 'username fullName profilePicture')
      .populate('following', 'username fullName profilePicture');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const isFollowing = user.followers.some(follower => 
      follower._id.toString() === currentUserId.toString()
    );

    const isOwnProfile = user._id.toString() === currentUserId.toString();

    const userProfile = {
      ...user.toObject(),
      followersCount: user.followers.length,
      followingCount: user.following.length,
      postsCount: user.postsCount || 0,
      isFollowing: isFollowing,
      isOwnProfile: isOwnProfile
    };

    res.json({
      success: true,
      data: {
        user: userProfile
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching user profile'
    });
  }
});

// ============================
// FOLLOW/UNFOLLOW ROUTES
// ============================

router.post('/follow/:userId', authenticateToken, async (req, res) => {
  try {
    const userIdToFollow = req.params.userId;
    const currentUserId = req.user._id;

    console.log(`👥 Follow request: ${currentUserId} wants to follow ${userIdToFollow}`);

    if (!mongoose.Types.ObjectId.isValid(userIdToFollow)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    if (userIdToFollow === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot follow yourself'
      });
    }

    const userToFollow = await User.findById(userIdToFollow).select('username fullName');
    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentUser = await User.findById(currentUserId).select('following');
    if (currentUser.following.includes(userIdToFollow)) {
      return res.status(400).json({
        success: false,
        error: 'You are already following this user'
      });
    }

    try {
      await User.findByIdAndUpdate(
        currentUserId,
        { $addToSet: { following: userIdToFollow } }
      );

      await User.findByIdAndUpdate(
        userIdToFollow,
        { $addToSet: { followers: currentUserId } }
      );

      console.log(`✅ User ${currentUserId} is now following ${userIdToFollow}`);

      try {
        await createNotification(
          userIdToFollow,
          currentUserId,
          'follow',
          `${req.user.username} started following you`,
          {}
        );
      } catch (notificationError) {
        console.error('❌ Error creating follow notification:', notificationError);
      }

      res.json({
        success: true,
        message: 'User followed successfully',
        data: {
          isFollowing: true,
          followedUser: {
            _id: userToFollow._id,
            username: userToFollow.username,
            fullName: userToFollow.fullName
          }
        }
      });

    } catch (updateError) {
      console.error('Error updating follow relationship:', updateError);
      
      try {
        await User.findByIdAndUpdate(
          currentUserId,
          { $pull: { following: userIdToFollow } }
        );
        await User.findByIdAndUpdate(
          userIdToFollow,
          { $pull: { followers: currentUserId } }
        );
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
      
      throw updateError;
    }

  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while following user'
    });
  }
});

router.post('/unfollow/:userId', authenticateToken, async (req, res) => {
  try {
    const userIdToUnfollow = req.params.userId;
    const currentUserId = req.user._id;

    console.log(`👥 Unfollow request: ${currentUserId} wants to unfollow ${userIdToUnfollow}`);

    if (!mongoose.Types.ObjectId.isValid(userIdToUnfollow)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    if (userIdToUnfollow === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot unfollow yourself'
      });
    }

    const userToUnfollow = await User.findById(userIdToUnfollow).select('username fullName');
    if (!userToUnfollow) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentUser = await User.findById(currentUserId).select('following');
    if (!currentUser.following.includes(userIdToUnfollow)) {
      return res.status(400).json({
        success: false,
        error: 'You are not following this user'
      });
    }

    try {
      await User.findByIdAndUpdate(
        currentUserId,
        { $pull: { following: userIdToUnfollow } }
      );

      await User.findByIdAndUpdate(
        userIdToUnfollow,
        { $pull: { followers: currentUserId } }
      );

      console.log(`✅ User ${currentUserId} unfollowed ${userIdToUnfollow}`);

      res.json({
        success: true,
        message: 'User unfollowed successfully',
        data: {
          isFollowing: false,
          unfollowedUser: {
            _id: userToUnfollow._id,
            username: userToUnfollow.username,
            fullName: userToUnfollow.fullName
          }
        }
      });

    } catch (updateError) {
      console.error('Error updating unfollow relationship:', updateError);
      
      try {
        await User.findByIdAndUpdate(
          currentUserId,
          { $addToSet: { following: userIdToUnfollow } }
        );
        await User.findByIdAndUpdate(
          userIdToUnfollow,
          { $addToSet: { followers: currentUserId } }
        );
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
      
      throw updateError;
    }

  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while unfollowing user'
    });
  }
});

// ============================
// FOLLOWERS/FOLLOWING ROUTES
// ============================

router.get('/:userId/followers', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId)
      .populate({
        path: 'followers',
        select: 'username fullName profilePicture bio',
        options: {
          skip: skip,
          limit: limit,
          sort: { createdAt: -1 }
        }
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const totalFollowers = user.followers.length;
    const totalPages = Math.ceil(totalFollowers / limit);

    res.json({
      success: true,
      followers: user.followers,
      pagination: {
        currentPage: page,
        totalPages,
        totalFollowers,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching followers'
    });
  }
});

router.get('/:userId/following', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId)
      .populate({
        path: 'following',
        select: 'username fullName profilePicture bio',
        options: {
          skip: skip,
          limit: limit,
          sort: { createdAt: -1 }
        }
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const totalFollowing = user.following.length;
    const totalPages = Math.ceil(totalFollowing / limit);

    res.json({
      success: true,
      following: user.following,
      pagination: {
        currentPage: page,
        totalPages,
        totalFollowing,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching following'
    });
  }
});

module.exports = router;
