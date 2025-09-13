const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/auth.js');

// Import Notification model
const Notification = require('../schema/notification.js');

// Get notifications for logged-in user (protected route)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ 
        error: 'Invalid pagination parameters',
        message: 'Page must be >= 1, limit must be between 1 and 100'
      });
    }

    console.log(`🔍 Fetching notifications for user: ${req.user._id}`);

    const notifications = await Notification.find({ userId: req.user._id })
      .populate({
        path: 'senderId',
        select: 'username fullName profilePicture',
        model: 'User'
      })
      .populate({
        path: 'postId',
        select: 'imageUrl caption createdAt',
        model: 'Post'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    console.log(`📦 Found ${notifications.length} notifications`);

    const totalNotifications = await Notification.countDocuments({ userId: req.user._id });
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    const totalPages = Math.ceil(totalNotifications / limit);

    // Add time ago virtual field manually since we're using lean()
    const notificationsWithTimeAgo = notifications.map(notification => ({
      ...notification,
      timeAgo: formatTimeAgo(notification.createdAt)
    }));

    res.json({
      success: true,
      notifications: notificationsWithTimeAgo,
      unreadCount,
      pagination: {
        currentPage: page,
        totalPages,
        totalNotifications,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server Error',
      message: 'Failed to fetch notifications' 
    });
  }
});

// Helper function to format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  
  return new Date(date).toLocaleDateString();
}

// Get unread notification count (protected route)
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ 
      userId: req.user._id, 
      isRead: false 
    });

    console.log(`📊 Unread count for user ${req.user._id}: ${unreadCount}`);

    res.json({ 
      success: true,
      unreadCount 
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server Error',
      message: 'Failed to fetch unread count' 
    });
  }
});

// Mark notification as read (protected route)
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid ID',
        message: 'Invalid notification ID format' 
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        userId: req.user._id
      },
      { 
        isRead: true,
        readAt: new Date()
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ 
        success: false,
        error: 'Not Found',
        message: 'Notification not found or you do not have permission to access it' 
      });
    }

    console.log(`✅ Marked notification ${notificationId} as read`);

    res.json({ 
      success: true,
      message: 'Notification marked as read',
      notification: {
        _id: notification._id,
        isRead: notification.isRead,
        readAt: notification.readAt
      }
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server Error',
      message: 'Failed to mark notification as read' 
    });
  }
});

// Mark all notifications as read (protected route)
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { 
        isRead: true,
        readAt: new Date()
      }
    );

    console.log(`✅ Marked ${result.modifiedCount} notifications as read for user ${req.user._id}`);

    res.json({ 
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server Error',
      message: 'Failed to mark all notifications as read' 
    });
  }
});

// Delete notification (protected route)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid ID',
        message: 'Invalid notification ID format' 
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ 
        success: false,
        error: 'Not Found',
        message: 'Notification not found or you do not have permission to delete it' 
      });
    }

    console.log(`🗑️ Deleted notification ${notificationId}`);

    res.json({ 
      success: true,
      message: 'Notification deleted successfully',
      deletedId: notificationId
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server Error',
      message: 'Failed to delete notification' 
    });
  }
});

// Delete all read notifications (protected route)
router.delete('/read/all', authenticateToken, async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      userId: req.user._id,
      isRead: true
    });

    console.log(`🗑️ Deleted ${result.deletedCount} read notifications for user ${req.user._id}`);

    res.json({ 
      success: true,
      message: 'All read notifications deleted successfully',
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Delete all read notifications error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server Error',
      message: 'Failed to delete read notifications' 
    });
  }
});

// Create notification (internal use - typically called from other routes)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { userId, type, postId, message, storyId, commentId } = req.body;

    console.log('📝 Creating notification:', { userId, type, postId, senderId: req.user._id, message });

    // Validation
    if (!userId || !type || !message) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'userId, type, and message are required'
      });
    }

    const validTypes = ['like', 'comment', 'follow', 'mention', 'story_like', 'story_view'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: `Type must be one of: ${validTypes.join(', ')}`
      });
    }

    // Validate userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Invalid userId format'
      });
    }

    // Don't create notification if user is notifying themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Operation',
        message: 'Cannot create notification for yourself'
      });
    }

    // Check if similar notification already exists (to prevent spam)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingNotification = await Notification.findOne({
      userId,
      senderId: req.user._id,
      type,
      postId: postId || null,
      storyId: storyId || null,
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (existingNotification) {
      console.log('⚠️ Similar notification already exists, skipping...');
      return res.status(400).json({
        success: false,
        error: 'Duplicate Notification',
        message: 'Similar notification already exists'
      });
    }

    const notificationData = {
      userId: new mongoose.Types.ObjectId(userId),
      senderId: req.user._id,
      type,
      message,
      isRead: false
    };

    // Add optional fields if provided
    if (postId && mongoose.Types.ObjectId.isValid(postId)) {
      notificationData.postId = new mongoose.Types.ObjectId(postId);
    }
    if (storyId && mongoose.Types.ObjectId.isValid(storyId)) {
      notificationData.storyId = new mongoose.Types.ObjectId(storyId);
    }
    if (commentId && mongoose.Types.ObjectId.isValid(commentId)) {
      notificationData.commentId = new mongoose.Types.ObjectId(commentId);
    }

    const notification = new Notification(notificationData);
    await notification.save();

    console.log('✅ Notification created successfully:', notification._id);

    // Populate the notification before sending response
    await notification.populate([
      {
        path: 'senderId',
        select: 'username fullName profilePicture'
      },
      {
        path: 'postId',
        select: 'imageUrl caption'
      }
    ]);

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      notification
    });

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server Error',
      message: 'Failed to create notification' 
    });
  }
});

// Helper function to create notification (can be used by other routes)
const createNotification = async (userId, senderId, type, message, options = {}) => {
  try {
    console.log('🔔 Creating notification via helper function:', { 
      userId: userId?.toString(), 
      senderId: senderId?.toString(), 
      type, 
      message 
    });

    // Validate required parameters
    if (!userId || !senderId || !type || !message) {
      console.error('❌ Missing required parameters for notification');
      return null;
    }

    // Ensure both IDs are valid ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(senderId)) {
      console.error('❌ Invalid ObjectId format for notification');
      return null;
    }

    // Don't create notification if user is notifying themselves
    if (userId.toString() === senderId.toString()) {
      console.log('⚠️ Skipping self-notification');
      return null;
    }

    // Check for duplicate notifications (within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingNotification = await Notification.findOne({
      userId,
      senderId,
      type,
      postId: options.postId || null,
      storyId: options.storyId || null,
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (existingNotification) {
      console.log('⚠️ Similar notification already exists, skipping...');
      return null;
    }

    const notificationData = {
      userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId,
      senderId: mongoose.Types.ObjectId.isValid(senderId) ? new mongoose.Types.ObjectId(senderId) : senderId,
      type,
      message,
      isRead: false
    };

    // Add optional fields
    if (options.postId && mongoose.Types.ObjectId.isValid(options.postId)) {
      notificationData.postId = new mongoose.Types.ObjectId(options.postId);
    }
    if (options.storyId && mongoose.Types.ObjectId.isValid(options.storyId)) {
      notificationData.storyId = new mongoose.Types.ObjectId(options.storyId);
    }
    if (options.commentId && mongoose.Types.ObjectId.isValid(options.commentId)) {
      notificationData.commentId = new mongoose.Types.ObjectId(options.commentId);
    }
    if (options.metadata) {
      notificationData.metadata = options.metadata;
    }

    const notification = new Notification(notificationData);
    await notification.save();

    console.log('✅ Notification created via helper function:', notification._id);
    return notification;

  } catch (error) {
    console.error('❌ Error creating notification via helper:', error);
    return null;
  }
};

module.exports = router;
module.exports.createNotification = createNotification;