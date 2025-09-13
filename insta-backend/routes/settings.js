const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/auth.js');
const User = require('../schema/user.js');
const Report = require('../schema/report.js');

const router = express.Router();

// Get user settings
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -loginAttempts -lockedUntil')
      .populate('blockedUsers', 'username fullName profilePicture');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching settings'
    });
  }
});

// Update account settings (username, email, fullName, bio, website, etc.)
router.put('/account', authenticateToken, async (req, res) => {
  try {
    const { username, email, fullName, bio, website, phoneNumber, dateOfBirth, gender } = req.body;
    const userId = req.user._id;

    const updateData = {};
    
    // Username validation
    if (username !== undefined) {
      if (!/^[a-zA-Z0-9_]+$/.test(username) || username.length < 3 || username.length > 30) {
        return res.status(400).json({
          success: false,
          error: 'Username must be 3-30 characters and contain only letters, numbers, and underscores'
        });
      }
      
      // Check if username is already taken
      const existingUser = await User.findOne({ 
        username: username.toLowerCase(),
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username is already taken'
        });
      }
      
      updateData.username = username.toLowerCase();
    }

    // Email validation
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid email address'
        });
      }
      
      // Check if email is already taken
      const existingEmail = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: userId }
      });
      
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email is already registered'
        });
      }
      
      updateData.email = email.toLowerCase();
    }

    // Other field validations
    if (fullName !== undefined) {
      if (!fullName.trim() || fullName.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Full name is required and must be less than 50 characters'
        });
      }
      updateData.fullName = fullName.trim();
    }

    if (bio !== undefined) {
      if (bio.length > 150) {
        return res.status(400).json({
          success: false,
          error: 'Bio must be less than 150 characters'
        });
      }
      updateData.bio = bio.trim();
    }

    if (website !== undefined) {
      updateData.website = website.trim();
    }

    if (phoneNumber !== undefined) {
      updateData.phoneNumber = phoneNumber.trim();
    }

    if (dateOfBirth !== undefined && dateOfBirth) {
      const date = new Date(dateOfBirth);
      if (isNaN(date.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
      }
      updateData.dateOfBirth = date;
    }

    if (gender !== undefined) {
      if (!['male', 'female', 'other', ''].includes(gender)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid gender value'
        });
      }
      updateData.gender = gender;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { 
        new: true,
        runValidators: true
      }
    ).select('-password -loginAttempts -lockedUntil');

    console.log('✅ Account settings updated:', userId);

    res.json({
      success: true,
      message: 'Account settings updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update account settings error:', error);
    
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
      error: 'Server error while updating account settings'
    });
  }
});

// Update privacy settings
router.put('/privacy', authenticateToken, async (req, res) => {
  try {
    const { 
      isPrivate, 
      showOnlineStatus, 
      allowTagging, 
      allowMessagesFromStrangers 
    } = req.body;
    
    const userId = req.user._id;
    const updateData = {};

    if (isPrivate !== undefined) {
      updateData.isPrivate = Boolean(isPrivate);
    }

    // Update privacy settings
    const privacySettings = {};
    if (showOnlineStatus !== undefined) {
      privacySettings['settings.privacy.showOnlineStatus'] = Boolean(showOnlineStatus);
    }
    if (allowTagging !== undefined) {
      privacySettings['settings.privacy.allowTagging'] = Boolean(allowTagging);
    }
    if (allowMessagesFromStrangers !== undefined) {
      privacySettings['settings.privacy.allowMessagesFromStrangers'] = Boolean(allowMessagesFromStrangers);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { ...updateData, ...privacySettings },
      { new: true, runValidators: true }
    ).select('-password -loginAttempts -lockedUntil');

    console.log('✅ Privacy settings updated:', userId);

    res.json({
      success: true,
      message: 'Privacy settings updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating privacy settings'
    });
  }
});

// Update notification settings
router.put('/notifications', authenticateToken, async (req, res) => {
  try {
    const { likes, comments, follows, mentions, messages } = req.body;
    const userId = req.user._id;

    const updateData = {};
    
    if (likes !== undefined) {
      updateData['settings.notifications.likes'] = Boolean(likes);
    }
    if (comments !== undefined) {
      updateData['settings.notifications.comments'] = Boolean(comments);
    }
    if (follows !== undefined) {
      updateData['settings.notifications.follows'] = Boolean(follows);
    }
    if (mentions !== undefined) {
      updateData['settings.notifications.mentions'] = Boolean(mentions);
    }
    if (messages !== undefined) {
      updateData['settings.notifications.messages'] = Boolean(messages);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -loginAttempts -lockedUntil');

    console.log('✅ Notification settings updated:', userId);

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating notification settings'
    });
  }
});

// Change password
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    // Get user with password
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await User.findByIdAndUpdate(userId, {
      password: hashedNewPassword,
      lastPasswordChange: new Date()
    });

    console.log('✅ Password updated for user:', userId);

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while changing password'
    });
  }
});

// Block user
router.post('/block/:userId', authenticateToken, async (req, res) => {
  try {
    const userIdToBlock = req.params.userId;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(userIdToBlock)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    if (userIdToBlock === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot block yourself'
      });
    }

    const userToBlock = await User.findById(userIdToBlock);
    if (!userToBlock) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentUser = await User.findById(currentUserId);
    
    // Use the instance method from the schema
    await currentUser.blockUser(userIdToBlock);

    console.log(`✅ User ${currentUserId} blocked ${userIdToBlock}`);

    res.json({
      success: true,
      message: 'User blocked successfully',
      blockedUser: {
        _id: userToBlock._id,
        username: userToBlock.username,
        fullName: userToBlock.fullName
      }
    });

  } catch (error) {
    console.error('Block user error:', error);
    
    if (error.message === 'Cannot block yourself') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error while blocking user'
    });
  }
});

// Unblock user
router.post('/unblock/:userId', authenticateToken, async (req, res) => {
  try {
    const userIdToUnblock = req.params.userId;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(userIdToUnblock)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    const currentUser = await User.findById(currentUserId);
    
    if (!currentUser.isUserBlocked(userIdToUnblock)) {
      return res.status(400).json({
        success: false,
        error: 'User is not blocked'
      });
    }

    // Use the instance method from the schema
    await currentUser.unblockUser(userIdToUnblock);

    const unblockedUser = await User.findById(userIdToUnblock).select('username fullName');

    console.log(`✅ User ${currentUserId} unblocked ${userIdToUnblock}`);

    res.json({
      success: true,
      message: 'User unblocked successfully',
      unblockedUser: {
        _id: unblockedUser._id,
        username: unblockedUser.username,
        fullName: unblockedUser.fullName
      }
    });

  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while unblocking user'
    });
  }
});

// Get blocked users
router.get('/blocked-users', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.user._id)
      .populate({
        path: 'blockedUsers',
        select: 'username fullName profilePicture',
        options: {
          skip: skip,
          limit: limit,
          sort: { username: 1 }
        }
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const totalBlocked = user.blockedUsers.length;
    const totalPages = Math.ceil(totalBlocked / limit);

    res.json({
      success: true,
      blockedUsers: user.blockedUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalBlocked,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching blocked users'
    });
  }
});

// Report content (user, post, comment)
router.post('/report', authenticateToken, async (req, res) => {
  try {
    const { reportType, reason, description, reportedUser, reportedPost, reportedComment } = req.body;
    const reporterId = req.user._id;

    // Validation
    if (!reportType || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Report type and reason are required'
      });
    }

    if (!['user', 'post', 'comment', 'story'].includes(reportType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report type'
      });
    }

    const validReasons = [
      'spam', 'harassment', 'hate_speech', 'violence', 'nudity',
      'copyright', 'fake_news', 'inappropriate_content', 'impersonation',
      'self_harm', 'terrorism', 'other'
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report reason'
      });
    }

    // Check if the required field for the report type is provided
    if (reportType === 'user' && !reportedUser) {
      return res.status(400).json({
        success: false,
        error: 'Reported user ID is required for user reports'
      });
    }

    if (reportType === 'post' && !reportedPost) {
      return res.status(400).json({
        success: false,
        error: 'Reported post ID is required for post reports'
      });
    }

    if (reportType === 'comment' && !reportedComment) {
      return res.status(400).json({
        success: false,
        error: 'Reported comment ID is required for comment reports'
      });
    }

    // Prepare report data
    const reportData = {
      reporter: reporterId,
      reportType,
      reason,
      description: description || ''
    };

    // Add the appropriate reported content ID
    if (reportType === 'user') reportData.reportedUser = reportedUser;
    if (reportType === 'post') reportData.reportedPost = reportedPost;
    if (reportType === 'comment') reportData.reportedComment = reportedComment;

    // Check for duplicate reports
    const existingReport = await Report.findOne({
      reporter: reporterId,
      reportType: reportType,
      ...(reportType === 'user' && { reportedUser }),
      ...(reportType === 'post' && { reportedPost }),
      ...(reportType === 'comment' && { reportedComment }),
      status: { $ne: 'dismissed' }
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        error: 'You have already reported this content'
      });
    }

    // Create report using the static method
    const report = await Report.createReport(reportData);

    console.log('✅ Report created:', report._id);

    res.json({
      success: true,
      message: 'Report submitted successfully',
      reportId: report._id
    });

  } catch (error) {
    console.error('Create report error:', error);
    
    if (error.message.includes('Cannot report yourself')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error while submitting report'
    });
  }
});

// Deactivate account
router.post('/deactivate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Use the instance method from the schema
    await user.deactivateAccount();

    console.log('✅ Account deactivated:', userId);

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deactivating account'
    });
  }
});

// Reactivate account (would be called during login if account is deactivated)
router.post('/reactivate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.accountStatus !== 'deactivated') {
      return res.status(400).json({
        success: false,
        error: 'Account is not deactivated'
      });
    }

    // Use the instance method from the schema
    await user.reactivateAccount();

    console.log('✅ Account reactivated:', userId);

    res.json({
      success: true,
      message: 'Account reactivated successfully'
    });

  } catch (error) {
    console.error('Reactivate account error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while reactivating account'
    });
  }
});

// Schedule account deletion (soft delete with grace period)
router.post('/delete-account', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user._id;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password confirmation is required'
      });
    }

    // Get user with password
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Password is incorrect'
      });
    }

    // Schedule deletion (30 days grace period)
    await user.scheduleAccountDeletion(30);

    console.log('✅ Account deletion scheduled:', userId);

    res.json({
      success: true,
      message: 'Account deletion scheduled for 30 days from now',
      deletionDate: user.deletionScheduledFor
    });

  } catch (error) {
    console.error('Schedule account deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while scheduling account deletion'
    });
  }
});

// Cancel account deletion
router.post('/cancel-deletion', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.deletionScheduledFor) {
      return res.status(400).json({
        success: false,
        error: 'No account deletion is scheduled'
      });
    }

    // Cancel deletion
    await user.cancelAccountDeletion();

    console.log('✅ Account deletion cancelled:', userId);

    res.json({
      success: true,
      message: 'Account deletion cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel account deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while cancelling account deletion'
    });
  }
});

module.exports = router;