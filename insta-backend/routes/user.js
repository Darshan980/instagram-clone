const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/auth.js');
const User = require('../schema/user.js');
const { createNotification } = require('../schema/notification.js');

const router = express.Router();

// IMPORTANT: Specific routes MUST come BEFORE parameter routes
// Order matters in Express routing!

// FIXED: Search route - BEFORE /:identifier
router.get('/search/:query', authenticateToken, async (req, res) => {
  try {
    const query = req.params.query.trim();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log('🔍 Search request received:');
    console.log('- Query:', query);
    console.log('- Page:', page);
    console.log('- Limit:', limit);
    console.log('- User:', req.user._id);

    // FIXED: Allow single character searches for better suggestions
    if (!query || query.length < 1) {
      console.log('❌ Query empty');
      return res.status(400).json({
        success: false,
        error: 'Search query cannot be empty'
      });
    }

    let users = [];
    let totalUsers = 0;

    // FIXED: If query is very short (1 character) or generic, get suggested users instead
    if (query.length === 1 || ['user', 'photo', 'gram', 'pic', 'a', 'e', 'i'].includes(query.toLowerCase())) {
      console.log('🎯 Using suggestion algorithm for short/generic query');
      
      // Get users that the current user is NOT following
      const currentUser = await User.findById(req.user._id).select('following');
      const followingIds = currentUser.following || [];
      
      // Add current user ID to exclusion list
      const excludeIds = [...followingIds, req.user._id];
      
      // First get total count of suggested users
      totalUsers = await User.countDocuments({
        _id: { $nin: excludeIds },
        isActive: { $ne: false } // Exclude inactive users
      });

      // Get suggested users (recently joined, active users)
      users = await User.find({
        _id: { $nin: excludeIds },
        isActive: { $ne: false }
      })
      .select('username fullName profilePicture bio followers following createdAt')
      .sort({ 
        createdAt: -1,  // Newer users first
        followers: -1   // Then by popularity
      })
      .skip(skip)
      .limit(limit)
      .lean();

      console.log('✨ Suggested users found:', users.length);
      
    } else {
      // FIXED: Normal search with better regex handling
      const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); // Escape special chars
      console.log('📝 Search regex:', searchRegex);
      
      // Get current user's following list to exclude already followed users
      const currentUser = await User.findById(req.user._id).select('following');
      const followingIds = currentUser.following || [];
      
      // Search criteria
      const searchCriteria = {
        $and: [
          {
            $or: [
              { username: searchRegex },
              { fullName: searchRegex }
            ]
          },
          {
            _id: { $ne: req.user._id } // Exclude current user
          },
          {
            isActive: { $ne: false } // Exclude inactive users
          }
        ]
      };
      
      // First get total count
      totalUsers = await User.countDocuments(searchCriteria);
      console.log('📊 Total matching users:', totalUsers);

      // Then get paginated results
      users = await User.find(searchCriteria)
      .select('username fullName profilePicture bio followers following createdAt')
      .skip(skip)
      .limit(limit)
      .sort({ 
        // Prioritize non-followed users
        followers: -1, // Popular users first
        createdAt: -1  // Then recent users
      })
      .lean();

      console.log('👥 Search users found:', users.length);
    }

    const totalPages = Math.ceil(totalUsers / limit);

    // FIXED: Add comprehensive user info including follow status
    const currentUser = await User.findById(req.user._id).select('following');
    const followingIds = (currentUser.following || []).map(id => id.toString());

    const usersWithInfo = users.map(user => ({
      ...user,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0,
      isFollowing: followingIds.includes(user._id.toString()),
      // Add time since joined for better suggestions
      daysSinceJoined: user.createdAt ? Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)) : 0
    }));

    console.log('✅ Sending search results with follow status');

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
        searchType: query.length === 1 || ['user', 'photo', 'gram', 'pic', 'a', 'e', 'i'].includes(query.toLowerCase()) ? 'suggestions' : 'search'
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

// FIXED: Dedicated suggestions endpoint - BEFORE /:identifier
router.get('/suggestions', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    console.log('💡 Getting user suggestions for:', req.user.username);
    console.log('- Page:', page);
    console.log('- Limit:', limit);

    // Get current user's following list
    const currentUser = await User.findById(req.user._id).select('following followers');
    
    if (!currentUser) {
      console.log('❌ Current user not found');
      return res.status(404).json({
        success: false,
        error: 'Current user not found'
      });
    }

    const followingIds = currentUser.following || [];
    const followerIds = currentUser.followers || [];
    
    // Exclude current user and already followed users
    const excludeIds = [...followingIds, req.user._id];

    // Strategy: Find users that current user's followers are following (friends of friends)
    let suggestedUsers = [];
    
    if (followerIds.length > 0) {
      console.log('🔍 Finding mutual connections...');
      
      try {
        // Get mutual connections (followers of people you follow)
        suggestedUsers = await User.aggregate([
          {
            // Find users who are followed by your followers
            $match: {
              followers: { $in: followerIds },
              _id: { $nin: excludeIds },
              isActive: { $ne: false }
            }
          },
          {
            // Add mutual followers count
            $addFields: {
              mutualFollowersCount: {
                $size: {
                  $setIntersection: ['$followers', followerIds]
                }
              }
            }
          },
          {
            // Sort by mutual connections first, then by popularity
            $sort: {
              mutualFollowersCount: -1,
              followers: -1,
              createdAt: -1
            }
          },
          {
            $skip: skip
          },
          {
            $limit: limit
          },
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
        
        console.log('✨ Found', suggestedUsers.length, 'mutual connections');
      } catch (aggregationError) {
        console.error('Aggregation error:', aggregationError);
        suggestedUsers = [];
      }
    }

    // If not enough suggestions from mutual connections, fill with popular new users
    if (suggestedUsers.length < limit) {
      console.log('🔍 Finding additional popular users...');
      
      const remainingLimit = limit - suggestedUsers.length;
      const existingSuggestionIds = suggestedUsers.map(u => u._id);
      
      try {
        const additionalUsers = await User.find({
          _id: { $nin: [...excludeIds, ...existingSuggestionIds] },
          isActive: { $ne: false }
        })
        .select('username fullName profilePicture bio followers following createdAt')
        .sort({ 
          createdAt: -1,  // Recent users
          followers: -1   // Popular users
        })
        .limit(remainingLimit)
        .lean();

        console.log('✨ Found', additionalUsers.length, 'additional users');

        // Add mutual followers count (will be 0 for these)
        const additionalUsersWithMutual = additionalUsers.map(user => ({
          ...user,
          mutualFollowersCount: 0
        }));

        suggestedUsers = [...suggestedUsers, ...additionalUsersWithMutual];
      } catch (findError) {
        console.error('Find additional users error:', findError);
      }
    }

    // Add additional user info
    const suggestionsWithInfo = suggestedUsers.map(user => ({
      ...user,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0,
      isFollowing: false, // These are non-followed users by definition
      suggestionReason: user.mutualFollowersCount > 0 
        ? `${user.mutualFollowersCount} mutual connection${user.mutualFollowersCount > 1 ? 's' : ''}`
        : 'Suggested for you'
    }));

    console.log('✅ Generated', suggestionsWithInfo.length, 'user suggestions');

    // FIXED: Always return a valid response structure
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

// FIXED: Get user profile - AFTER specific routes
router.get('/:identifier', authenticateToken, async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const currentUserId = req.user._id;
    let query = {};

    console.log('👤 Getting profile for:', identifier, 'Current user:', currentUserId);

    // Check if identifier is a valid ObjectId (user ID) or username
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      query._id = identifier;
    } else {
      query.username = identifier.toLowerCase();
    }

    // FIXED: Explicitly exclude password (since select: false doesn't work with populate)
    const user = await User.findOne(query)
      .select('-password -email -emailVerificationToken -emailVerificationExpires -lockedUntil -loginAttempts')
      .populate('followers', 'username fullName profilePicture')
      .populate('following', 'username fullName profilePicture');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if current user is following this user
    const isFollowing = user.followers.some(follower => 
      follower._id.toString() === currentUserId.toString()
    );

    // Check if this is the current user's own profile
    const isOwnProfile = user._id.toString() === currentUserId.toString();

    // Add additional user stats and follow status
    const userProfile = {
      ...user.toObject(),
      followersCount: user.followers.length,
      followingCount: user.following.length,
      postsCount: user.postsCount || 0, // Use the existing postsCount field
      isFollowing: isFollowing,
      isOwnProfile: isOwnProfile
    };

    console.log('✅ Profile loaded with follow status:', isFollowing);

    res.json({
      success: true,
      user: userProfile
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching user profile'
    });
  }
});

// Follow a user (without transactions for standalone MongoDB)
router.post('/follow/:userId', authenticateToken, async (req, res) => {
  try {
    const userIdToFollow = req.params.userId;
    const currentUserId = req.user._id;

    console.log(`👥 Follow request: ${currentUserId} wants to follow ${userIdToFollow}`);

    // Validation
    if (!mongoose.Types.ObjectId.isValid(userIdToFollow)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    // Can't follow yourself
    if (userIdToFollow === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot follow yourself'
      });
    }

    // Find the user to follow - NO PASSWORD NEEDED
    const userToFollow = await User.findById(userIdToFollow).select('username fullName');
    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if already following - NO PASSWORD NEEDED
    const currentUser = await User.findById(currentUserId).select('following');
    if (currentUser.following.includes(userIdToFollow)) {
      return res.status(400).json({
        success: false,
        error: 'You are already following this user'
      });
    }

    // Update both users (without transaction)
    try {
      // Add to current user's following list
      await User.findByIdAndUpdate(
        currentUserId,
        { $addToSet: { following: userIdToFollow } }
      );

      // Add to target user's followers list
      await User.findByIdAndUpdate(
        userIdToFollow,
        { $addToSet: { followers: currentUserId } }
      );

      console.log(`✅ User ${currentUserId} is now following ${userIdToFollow}`);

      // Create notification for the followed user
      try {
        await createNotification(
          userIdToFollow, // userId (who receives the notification)
          currentUserId,  // senderId (who performed the action)
          'follow',       // type
          `${req.user.username} started following you`, // message
          {} // options
        );

        console.log(`🔔 Follow notification created`);
      } catch (notificationError) {
        console.error('❌ Error creating follow notification:', notificationError);
        // Don't fail the follow request if notification fails
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
      
      // Try to rollback if one operation succeeded but the other failed
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

// Unfollow a user (without transactions for standalone MongoDB)
router.post('/unfollow/:userId', authenticateToken, async (req, res) => {
  try {
    const userIdToUnfollow = req.params.userId;
    const currentUserId = req.user._id;

    console.log(`👥 Unfollow request: ${currentUserId} wants to unfollow ${userIdToUnfollow}`);

    // Validation
    if (!mongoose.Types.ObjectId.isValid(userIdToUnfollow)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    // Can't unfollow yourself
    if (userIdToUnfollow === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot unfollow yourself'
      });
    }

    // Find the user to unfollow - NO PASSWORD NEEDED
    const userToUnfollow = await User.findById(userIdToUnfollow).select('username fullName');
    if (!userToUnfollow) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if actually following - NO PASSWORD NEEDED
    const currentUser = await User.findById(currentUserId).select('following');
    if (!currentUser.following.includes(userIdToUnfollow)) {
      return res.status(400).json({
        success: false,
        error: 'You are not following this user'
      });
    }

    // Update both users (without transaction)
    try {
      // Remove from current user's following list
      await User.findByIdAndUpdate(
        currentUserId,
        { $pull: { following: userIdToUnfollow } }
      );

      // Remove from target user's followers list
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
      
      // Try to rollback if one operation succeeded but the other failed
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

// Get user's followers
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

// Get user's following
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

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, bio, profilePicture } = req.body;
    const userId = req.user._id;

    const updateData = {};
    
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
      updateData.bio = bio.trim();
    }

    if (profilePicture !== undefined) {
      if (typeof profilePicture !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Profile picture must be a valid URL'
        });
      }
      updateData.profilePicture = profilePicture;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { 
        new: true,
        runValidators: true
      }
    ).select('-password -emailVerificationToken -emailVerificationExpires -lockedUntil -loginAttempts');

    console.log(`✅ User profile updated: ${userId}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });

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

    res.status(500).json({
      success: false,
      error: 'Server error while updating profile'
    });
  }
});

module.exports = router;
