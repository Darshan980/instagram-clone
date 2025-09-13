const mongoose = require('mongoose');

// Notification Schema
const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender ID is required']
  },
  type: {
    type: String,
    enum: {
      values: ['like', 'comment', 'follow', 'mention', 'story_like', 'story_view'],
      message: 'Type must be one of: like, comment, follow, mention, story_like, story_view'
    },
    required: [true, 'Notification type is required']
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: false,
    default: null
  },
  storyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Story',
    required: false,
    default: null
  },
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    required: false,
    default: null
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    maxlength: [500, 'Message cannot exceed 500 characters'],
    trim: true
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ senderId: 1, createdAt: -1 });

// Pre-save middleware to set readAt when isRead changes to true
notificationSchema.pre('save', function(next) {
  if (this.isModified('isRead') && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }
  next();
});

// Pre-update middleware for findOneAndUpdate operations
notificationSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.isRead === true && !update.readAt) {
    update.readAt = new Date();
  }
  next();
});

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to create notification with validation (FIXED)
notificationSchema.statics.createNotification = async function(data) {
  try {
    const { userId, senderId, type, postId, storyId, commentId, message, metadata } = data;
    
    // Validate required parameters
    if (!userId || !senderId || !type || !message) {
      throw new Error('Missing required fields: userId, senderId, type, and message are required');
    }
    
    // Convert to ObjectId if they are strings
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? userId : new mongoose.Types.ObjectId(userId);
    const senderObjectId = mongoose.Types.ObjectId.isValid(senderId) ? senderId : new mongoose.Types.ObjectId(senderId);
    
    // Don't create notification if user is notifying themselves
    if (userObjectId.toString() === senderObjectId.toString()) {
      console.log('Skipping self-notification');
      return null;
    }
    
    // Check for duplicate notifications (within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingNotification = await this.findOne({
      userId: userObjectId,
      senderId: senderObjectId,
      type,
      postId: postId || null,
      storyId: storyId || null,
      createdAt: { $gte: fiveMinutesAgo }
    });
    
    if (existingNotification) {
      console.log('Similar notification already exists, skipping...');
      return existingNotification;
    }
    
    // Create notification data object
    const notificationData = {
      userId: userObjectId,
      senderId: senderObjectId,
      type,
      message,
      metadata: metadata || {}
    };
    
    // Add optional fields only if they exist and are valid
    if (postId && mongoose.Types.ObjectId.isValid(postId)) {
      notificationData.postId = postId;
    }
    
    if (storyId && mongoose.Types.ObjectId.isValid(storyId)) {
      notificationData.storyId = storyId;
    }
    
    if (commentId && mongoose.Types.ObjectId.isValid(commentId)) {
      notificationData.commentId = commentId;
    }
    
    console.log('Creating notification with data:', notificationData);
    
    const notification = new this(notificationData);
    const savedNotification = await notification.save();
    
    console.log('Notification created successfully:', savedNotification._id);
    return savedNotification;
    
  } catch (error) {
    console.error('Error in createNotification:', error);
    throw error;
  }
};

// Static method to get user's notification stats
notificationSchema.statics.getUserStats = async function(userId) {
  try {
    const pipeline = [
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] } }
        }
      }
    ];
    
    const result = await this.aggregate(pipeline);
    return result[0] || { total: 0, unread: 0, read: 0 };
  } catch (error) {
    console.error('Error in getUserStats:', error);
    return { total: 0, unread: 0, read: 0 };
  }
};

// Static method to get notifications by type
notificationSchema.statics.getNotificationsByType = async function(userId, type, options = {}) {
  try {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;
    
    return this.find({ userId, type })
      .populate('senderId', 'username fullName profilePicture')
      .populate('postId', 'imageUrl caption')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  } catch (error) {
    console.error('Error in getNotificationsByType:', error);
    return [];
  }
};

// Static method to get all notifications for a user
notificationSchema.statics.getUserNotifications = async function(userId, options = {}) {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const skip = (page - 1) * limit;
    
    const query = { userId };
    if (unreadOnly) {
      query.isRead = false;
    }
    
    return this.find(query)
      .populate('senderId', 'username fullName profilePicture')
      .populate('postId', 'imageUrl caption')
      .populate('storyId', 'mediaUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  } catch (error) {
    console.error('Error in getUserNotifications:', error);
    return [];
  }
};

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = async function(userId, notificationIds = []) {
  try {
    const query = { userId, isRead: false };
    
    // If specific notification IDs are provided, only mark those as read
    if (notificationIds.length > 0) {
      query._id = { $in: notificationIds };
    }
    
    const result = await this.updateMany(query, {
      isRead: true,
      readAt: new Date()
    });
    
    console.log(`Marked ${result.modifiedCount} notifications as read for user ${userId}`);
    return result;
  } catch (error) {
    console.error('Error in markAsRead:', error);
    throw error;
  }
};

// Virtual for time elapsed since creation
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  
  return this.createdAt.toLocaleDateString();
});

// Ensure virtual fields are serialized
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

// Export the model
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;