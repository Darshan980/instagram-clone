const express = require('express');
const bcrypt = require('bcrypt');
const { authenticateToken } = require('../../middleware/auth.js');
const User = require('../../schema/user.js');
const { createNotification } = require('../../schema/notification.js');

const router = express.Router();

// Change Password
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const userId = req.user._id;

    console.log(`🔒 Password change request for user: ${userId}`);

    // Validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        error: 'All password fields are required'
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        error: 'New passwords do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password must be different from current password'
      });
    }

    // Get current user with password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      console.log(`❌ Invalid current password for user: ${userId}`);
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and lastPasswordChange
    await User.findByIdAndUpdate(userId, {
      password: hashedNewPassword,
      lastPasswordChange: new Date(),
      // Reset login attempts when password is changed
      $unset: { loginAttempts: 1, lockedUntil: 1 }
    });

    console.log(`✅ Password changed successfully for user: ${userId}`);

    // Create notification for security
    try {
      await createNotification(
        userId,
        userId,
        'security',
        'Your password was changed successfully',
        { securityEvent: 'password_change' }
      );
    } catch (notificationError) {
      console.error('Error creating password change notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while changing password'
    });
  }
});

// Change Email
router.put('/email', authenticateToken, async (req, res) => {
  try {
    const { newEmail, password } = req.body;
    const userId = req.user._id;

    console.log(`📧 Email change request for user: ${userId}`);

    // Validation
    if (!newEmail || !password) {
      return res.status(400).json({
        success: false,
        error: 'New email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    // Normalize email
    const normalizedEmail = newEmail.toLowerCase().trim();

    // Get current user with password
    const user = await User.findById(userId).select('+password +email');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if email is the same
    if (user.email === normalizedEmail) {
      return res.status(400).json({
        success: false,
        error: 'New email must be different from current email'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log(`❌ Invalid password for email change: ${userId}`);
      return res.status(400).json({
        success: false,
        error: 'Password is incorrect'
      });
    }

    // Check if email is already taken
    const existingUser = await User.findOne({ 
      email: normalizedEmail,
      _id: { $ne: userId }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'This email is already associated with another account'
      });
    }

    // Update email
    const oldEmail = user.email;
    await User.findByIdAndUpdate(userId, {
      email: normalizedEmail
    });

    console.log(`✅ Email changed successfully for user: ${userId}`);
    console.log(`Old email: ${oldEmail}, New email: ${normalizedEmail}`);

    // Create notification for security
    try {
      await createNotification(
        userId,
        userId,
        'security',
        `Your email was changed from ${oldEmail} to ${normalizedEmail}`,
        { 
          securityEvent: 'email_change',
          oldEmail: oldEmail,
          newEmail: normalizedEmail
        }
      );
    } catch (notificationError) {
      console.error('Error creating email change notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'Email changed successfully',
      data: {
        newEmail: normalizedEmail
      }
    });

  } catch (error) {
    console.error('Change email error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'This email is already associated with another account'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error while changing email'
    });
  }
});

// Deactivate Account
router.post('/deactivate', authenticateToken, async (req, res) => {
  try {
    const { password, reason } = req.body;
    const userId = req.user._id;

    console.log(`🔒 Account deactivation request for user: ${userId}`);

    // Validation
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required to deactivate account'
      });
    }

    // Get current user with password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if account is already deactivated
    if (user.accountStatus === 'deactivated') {
      return res.status(400).json({
        success: false,
        error: 'Account is already deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log(`❌ Invalid password for account deactivation: ${userId}`);
      return res.status(400).json({
        success: false,
        error: 'Password is incorrect'
      });
    }

    // Deactivate account
    await user.deactivateAccount();

    // Store deactivation reason if provided
    if (reason) {
      await User.findByIdAndUpdate(userId, {
        'settings.deactivationReason': reason
      });
    }

    console.log(`✅ Account deactivated successfully for user: ${userId}`);

    // Create notification for security
    try {
      await createNotification(
        userId,
        userId,
        'security',
        'Your account has been deactivated',
        { 
          securityEvent: 'account_deactivated',
          reason: reason || 'No reason provided',
          deactivatedAt: new Date()
        }
      );
    } catch (notificationError) {
      console.error('Error creating deactivation notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'Account deactivated successfully. You can reactivate it anytime by logging in again.',
      data: {
        accountStatus: 'deactivated',
        deactivatedAt: user.deactivatedAt
      }
    });

  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deactivating account'
    });
  }
});

// Reactivate Account (This would typically be called during login)
router.post('/reactivate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    console.log(`🔓 Account reactivation request for user: ${userId}`);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if account is deactivated
    if (user.accountStatus !== 'deactivated') {
      return res.status(400).json({
        success: false,
        error: 'Account is not deactivated'
      });
    }

    // Reactivate account
    await user.reactivateAccount();

    console.log(`✅ Account reactivated successfully for user: ${userId}`);

    // Create notification for security
    try {
      await createNotification(
        userId,
        userId,
        'security',
        'Your account has been reactivated',
        { 
          securityEvent: 'account_reactivated',
          reactivatedAt: new Date()
        }
      );
    } catch (notificationError) {
      console.error('Error creating reactivation notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'Account reactivated successfully',
      data: {
        accountStatus: 'active',
        reactivatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Reactivate account error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while reactivating account'
    });
  }
});

// Get Security Settings
router.get('/security-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('settings lastPasswordChange createdAt accountStatus');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        lastPasswordChange: user.lastPasswordChange,
        twoFactorEnabled: user.settings?.security?.twoFactorEnabled || false,
        loginNotifications: user.settings?.security?.loginNotifications !== false,
        accountCreated: user.createdAt,
        accountStatus: user.accountStatus
      }
    });

  } catch (error) {
    console.error('Get security settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching security settings'
    });
  }
});

// Update Security Settings
router.put('/security-settings', authenticateToken, async (req, res) => {
  try {
    const { twoFactorEnabled, loginNotifications } = req.body;
    const userId = req.user._id;

    const updateData = {};

    if (typeof twoFactorEnabled === 'boolean') {
      updateData['settings.security.twoFactorEnabled'] = twoFactorEnabled;
    }

    if (typeof loginNotifications === 'boolean') {
      updateData['settings.security.loginNotifications'] = loginNotifications;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid security settings provided'
      });
    }

    await User.findByIdAndUpdate(userId, updateData);

    console.log(`✅ Security settings updated for user: ${userId}`);

    res.json({
      success: true,
      message: 'Security settings updated successfully'
    });

  } catch (error) {
    console.error('Update security settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating security settings'
    });
  }
});

module.exports = router;