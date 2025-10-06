const mongoose = require('mongoose');

const liveStreamSchema = new mongoose.Schema({
  // Stream owner
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Stream details
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  description: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Stream status
  status: {
    type: String,
    enum: ['scheduled', 'live', 'ended', 'cancelled'],
    default: 'live',
    index: true
  },

  // Stream metadata
  thumbnail: {
    type: String,
    default: ''
  },

  // Stream URL/ID (for video streaming service integration)
  streamKey: {
    type: String,
    unique: true,
    sparse: true
  },

  streamUrl: {
    type: String
  },

  // Viewer tracking
  viewers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  currentViewerCount: {
    type: Number,
    default: 0
  },

  peakViewerCount: {
    type: Number,
    default: 0
  },

  totalViews: {
    type: Number,
    default: 0
  },

  // Engagement
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Timing
  scheduledStartTime: {
    type: Date
  },

  startedAt: {
    type: Date,
    default: Date.now
  },

  endedAt: {
    type: Date
  },

  duration: {
    type: Number, // in seconds
    default: 0
  },

  // Privacy settings
  isPrivate: {
    type: Boolean,
    default: false
  },

  allowedViewers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Settings
  allowComments: {
    type: Boolean,
    default: true
  },

  allowSharing: {
    type: Boolean,
    default: true
  },

  // Recording
  isRecorded: {
    type: Boolean,
    default: false
  },

  recordingUrl: {
    type: String
  },

  // Metadata
  category: {
    type: String,
    enum: ['general', 'gaming', 'music', 'sports', 'education', 'entertainment', 'other'],
    default: 'general'
  },

  tags: [{
    type: String,
    trim: true
  }],

  // Analytics
  analytics: {
    averageWatchTime: {
      type: Number,
      default: 0
    },
    engagementRate: {
      type: Number,
      default: 0
    },
    shareCount: {
      type: Number,
      default: 0
    }
  }

}, {
  timestamps: true
});

// Indexes for performance
liveStreamSchema.index({ user: 1, status: 1 });
liveStreamSchema.index({ status: 1, startedAt: -1 });
liveStreamSchema.index({ createdAt: -1 });

// Virtual for like count
liveStreamSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Virtual for comment count
liveStreamSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// Method to add viewer
liveStreamSchema.methods.addViewer = async function(userId) {
  if (!this.viewers.includes(userId)) {
    this.viewers.push(userId);
    this.currentViewerCount = this.viewers.length;
    this.totalViews += 1;
    
    if (this.currentViewerCount > this.peakViewerCount) {
      this.peakViewerCount = this.currentViewerCount;
    }
    
    await this.save();
  }
};

// Method to remove viewer
liveStreamSchema.methods.removeViewer = async function(userId) {
  const index = this.viewers.indexOf(userId);
  if (index > -1) {
    this.viewers.splice(index, 1);
    this.currentViewerCount = this.viewers.length;
    await this.save();
  }
};

// Method to end stream
liveStreamSchema.methods.endStream = async function() {
  this.status = 'ended';
  this.endedAt = new Date();
  this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
  this.currentViewerCount = 0;
  this.viewers = [];
  await this.save();
};

// Static method to get active streams
liveStreamSchema.statics.getActiveStreams = function() {
  return this.find({ status: 'live' })
    .populate('user', 'username fullName profilePicture')
    .sort({ currentViewerCount: -1, startedAt: -1 });
};

// Static method to get user's streams
liveStreamSchema.statics.getUserStreams = function(userId) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 });
};

const LiveStream = mongoose.model('LiveStream', liveStreamSchema);

module.exports = LiveStream;
