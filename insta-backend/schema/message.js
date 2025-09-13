const mongoose = require('mongoose');

// Message Schema
const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: function() {
      return !this.imageUrl; // Text is required if no image
    },
    maxlength: 1000
  },
  imageUrl: {
    type: String,
    required: false
  },
  cloudinaryId: {
    type: String,
    required: false
  },
  isRead: {
    type: Boolean,
    default: false
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'mixed'],
    default: function() {
      if (this.text && this.imageUrl) return 'mixed';
      if (this.imageUrl) return 'image';
      return 'text';
    }
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, isRead: 1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ text: 'text' }); // Text index for search functionality

// Virtual for conversation participants
messageSchema.virtual('conversationId').get(function() {
  return [this.senderId, this.receiverId].sort().join('-');
});

// Pre-save middleware to set messageType
messageSchema.pre('save', function(next) {
  if (this.text && this.imageUrl) {
    this.messageType = 'mixed';
  } else if (this.imageUrl) {
    this.messageType = 'image';
  } else {
    this.messageType = 'text';
  }
  next();
});

// Instance method to mark as read
messageSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

// Instance method to soft delete
messageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Static method to get conversation messages
messageSchema.statics.getConversationMessages = function(userId1, userId2, options = {}) {
  const { page = 1, limit = 50, includeDeleted = false } = options;
  const skip = (page - 1) * limit;

  const query = {
    $or: [
      { senderId: userId1, receiverId: userId2 },
      { senderId: userId2, receiverId: userId1 }
    ]
  };

  if (!includeDeleted) {
    query.isDeleted = false;
  }

  return this.find(query)
    .populate('senderId', 'username fullName profilePicture')
    .populate('receiverId', 'username fullName profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get unread count for a user
messageSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    receiverId: userId,
    isRead: false,
    isDeleted: false
  });
};

// Conversation Schema (for easier conversation management)
const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    archivedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isMuted: {
    type: Boolean,
    default: false
  },
  mutedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    mutedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Add indexes for participants and lastMessageAt
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

// Ensure only two participants per conversation (for direct messages)
conversationSchema.pre('save', function(next) {
  if (this.participants.length > 2) {
    const error = new Error('Direct conversations can only have 2 participants');
    error.name = 'ValidationError';
    return next(error);
  }
  
  // Sort participants to ensure consistent ordering
  this.participants.sort();
  next();
});

// Virtual for conversation ID
conversationSchema.virtual('conversationId').get(function() {
  return this.participants.sort().join('-');
});

// Instance method to get other participant
conversationSchema.methods.getOtherParticipant = function(currentUserId) {
  return this.participants.find(participant => 
    participant.toString() !== currentUserId.toString()
  );
};

// Instance method to check if user is participant
conversationSchema.methods.isParticipant = function(userId) {
  return this.participants.some(participant => 
    participant.toString() === userId.toString()
  );
};

// Instance method to archive conversation for a user
conversationSchema.methods.archiveForUser = function(userId) {
  const existingArchive = this.archivedBy.find(archive => 
    archive.user.toString() === userId.toString()
  );
  
  if (!existingArchive) {
    this.archivedBy.push({ user: userId });
  }
  
  return this.save();
};

// Instance method to unarchive conversation for a user
conversationSchema.methods.unarchiveForUser = function(userId) {
  this.archivedBy = this.archivedBy.filter(archive => 
    archive.user.toString() !== userId.toString()
  );
  
  return this.save();
};

// Instance method to mute conversation for a user
conversationSchema.methods.muteForUser = function(userId) {
  const existingMute = this.mutedBy.find(mute => 
    mute.user.toString() === userId.toString()
  );
  
  if (!existingMute) {
    this.mutedBy.push({ user: userId });
  }
  
  return this.save();
};

// Instance method to unmute conversation for a user
conversationSchema.methods.unmuteForUser = function(userId) {
  this.mutedBy = this.mutedBy.filter(mute => 
    mute.user.toString() !== userId.toString()
  );
  
  return this.save();
};

// Static method to find or create conversation
conversationSchema.statics.findOrCreate = async function(participant1, participant2) {
  const participants = [participant1, participant2].sort();
  
  let conversation = await this.findOne({
    participants: { $all: participants }
  });
  
  if (!conversation) {
    conversation = new this({
      participants: participants,
      lastMessageAt: new Date()
    });
    await conversation.save();
  }
  
  return conversation;
};

// Static method to get user conversations
conversationSchema.statics.getUserConversations = function(userId, options = {}) {
  const { page = 1, limit = 20, includeArchived = false } = options;
  const skip = (page - 1) * limit;

  const query = { participants: userId };
  
  if (!includeArchived) {
    query['archivedBy.user'] = { $ne: userId };
  }

  return this.find(query)
    .populate('participants', 'username fullName profilePicture')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Export models
const Message = mongoose.model('Message', messageSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = {
  Message,
  Conversation
};