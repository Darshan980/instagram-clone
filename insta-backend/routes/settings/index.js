const express = require('express');
const { authenticateToken } = require('../../middleware/auth.js');
const User = require('../../schema/user.js');

const router = express.Router();

// Import sub-routes
const authSettingsRoutes = require('./auth.js');

// Use sub-routes
router.use('/auth', authSettingsRoutes);

// Get all user settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select(
      'username email fullName bio website phoneNumber gender dateOfBirth profilePicture settings accountStatus isPrivate lastPasswordChange'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log(`📋 Settings retrieved for user: ${userId}`);

    res.json({
      success: true,
      data: {
        // Account Information
        account: {
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          bio: user.bio,
          website: user.website,
          phoneNumber: user.phoneNumber,
          gender: user.gender,
          dateOfBirth: user.dateOfBirth,
          profilePicture: user.profilePicture
        },
        
        // Privacy Settings
        privacy: {
          isPrivate: user.isPrivate,
          showOnlineStatus: user.settings?.privacy?.showOnlineStatus !== false,
          allowTagging: user.settings?.privacy?.allowTagging !== false,
          allowMessagesFromStrangers: user.settings?.privacy?.allowMessagesFromStrangers === true
        },
        
        // Notification Settings
        notifications: {
          likes: user.settings?.notifications?.likes !== false,
          comments: user.settings?.notifications?.comments !== false,
          follows: user.settings?.notifications?.follows !== false,
          mentions: user.settings?.notifications?.mentions !== false,
          messages: user.settings?.notifications?.messages !== false
        },
        
        // Security Settings
        security: {
          twoFactorEnabled: user.settings?.security?.twoFactorEnabled === true,
          loginNotifications: user.settings?.security?.loginNotifications !== false,
          lastPasswordChange: user.lastPasswordChange
        },
        
        // Account Status
        accountStatus: user.accountStatus
      }
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching settings'
    });
  }
});

// Update Account Settings
router.put('/account', authenticateToken, async (req, res) => {
  try {
    const { fullName, bio, website, phoneNumber, gender, dateOfBirth } = req.body;
    const userId = req.user._id;

    const updateData = {};

    // Validate and update full name
    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || fullName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Full name is required and must be a string'
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

    // Validate and update bio
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

    // Validate and update website
    if (website !== undefined) {
      if (typeof website !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Website must be a string'
        });
      }
      updateData.website = website.trim();
    }

    // Validate and update phone number
    if (phoneNumber !== undefined) {
      if (typeof phoneNumber !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Phone number must be a string'
        });
      }
      updateData.phoneNumber = phoneNumber.trim();
    }

    // Validate and update gender
    if (gender !== undefined) {
      if (!['male', 'female', 'other', ''].includes(gender)) {
        return res.status(400).json({
          success: false,
          error: 'Gender must be one of: male, female, other, or empty string'
        });
      }
      updateData.gender = gender;
    }

    // Validate and update date of birth
    if (dateOfBirth !== undefined) {
      if (dateOfBirth && !Date.parse(dateOfBirth)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date of birth format'
        });
      }
      updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    console.log(`✅ Account settings updated for user: ${userId}`);

    res.json({
      success: true,
      message: 'Account settings updated successfully',
      data: {
        fullName: updatedUser.fullName,
        bio: updatedUser.bio,
        website: updatedUser.website,
        phoneNumber: updatedUser.phoneNumber,
        gender: updatedUser.gender,
        dateOfBirth: updatedUser.dateOfBirth
      }
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

// Update Privacy Settings
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

    if (typeof isPrivate === 'boolean') {
      updateData.isPrivate = isPrivate;
    }

    if (typeof showOnlineStatus === 'boolean') {
      updateData['settings.privacy.showOnlineStatus'] = showOnlineStatus;
    }

    if (typeof allowTagging === 'boolean') {
      updateData['settings.privacy.allowTagging'] = allowTagging;
    }

    if (typeof allowMessagesFromStrangers === 'boolean') {
      updateData['settings.privacy.allowMessagesFromStrangers'] = allowMessagesFromStrangers;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid privacy settings provided'
      });
    }

    await User.findByIdAndUpdate(userId, updateData);

    console.log(`🔒 Privacy settings updated for user: ${userId}`);

    res.json({
      success: true,
      message: 'Privacy settings updated successfully'
    });

  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating privacy settings'
    });
  }
});

// Update Notification Settings
router.put('/notifications', authenticateToken, async (req, res) => {
  try {
    const { likes, comments, follows, mentions, messages } = req.body;
    const userId = req.user._id;

    const updateData = {};

    if (typeof likes === 'boolean') {
      updateData['settings.notifications.likes'] = likes;
    }

    if (typeof comments === 'boolean') {
      updateData['settings.notifications.comments'] = comments;
    }

    if (typeof follows === 'boolean') {
      updateData['settings.notifications.follows'] = follows;
    }

    if (typeof mentions === 'boolean') {
      updateData['settings.notifications.mentions'] = mentions;
    }

    if (typeof messages === 'boolean') {
      updateData['settings.notifications.messages'] = messages;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid notification settings provided'
      });
    }

    await User.findByIdAndUpdate(userId, updateData);

    console.log(`🔔 Notification settings updated for user: ${userId}`);

    res.json({
      success: true,
      message: 'Notification settings updated successfully'
    });

  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating notification settings'
    });
  }
});

module.exports = router;