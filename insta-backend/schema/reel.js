const mongoose = require('mongoose');

console.log('🎬 Defining Reel schema...');

const ReelSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  videoUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  cloudinaryId: {
    type: String,
    default: null
  },
  cloudinaryThumbnailId: {
    type: String,
    default: null
  },
  caption: {
    type: String,
    maxLength: 2200,
    default: ''
  },
  hashtags: [{
    type: String,
    trim: true
  }],
  musicTrack: {
    name: String,
    artist: String,
    url: String
  },
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
      maxLength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // FIXED: Simplified views structure with proper indexing
  views: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // ADDED: Total unique views counter for better performance
  totalViews: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0
  },
  aspectRatio: {
    type: String,
    default: '9:16'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add indexes for better performance
ReelSchema.index({ user: 1, createdAt: -1 });
ReelSchema.index({ hashtags: 1 });
ReelSchema.index({ createdAt: -1 });
ReelSchema.index({ isActive: 1 });
ReelSchema.index({ 'musicTrack.name': 1 });
ReelSchema.index({ likes: 1 });
ReelSchema.index({ totalViews: -1 }); // Index for sorting by popularity
ReelSchema.index({ 'views.user': 1, 'views.viewedAt': -1 }); // Compound index for view tracking

// FIXED: Improved view tracking method with better logic
ReelSchema.methods.addView = async function(userId) {
  try {
    if (!userId) {
      console.log('⚠️ No userId provided for view tracking');
      return this.totalViews || 0;
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Check if user has viewed this reel in the last 24 hours
    const existingViewIndex = this.views.findIndex(view => 
      view.user && view.user.toString() === userId.toString() && 
      view.viewedAt > twentyFourHoursAgo
    );
    
    let shouldSave = false;
    
    if (existingViewIndex === -1) {
      // No recent view found, add new view
      this.views.push({ 
        user: userId, 
        viewedAt: now 
      });
      
      // Update total views counter
      this.totalViews = (this.totalViews || 0) + 1;
      shouldSave = true;
      
      console.log(`📊 New view added for reel ${this._id} by user ${userId}. Total views: ${this.totalViews}`);
    } else {
      // Recent view exists, update the timestamp
      this.views[existingViewIndex].viewedAt = now;
      shouldSave = true;
      
      console.log(`🔄 View timestamp updated for reel ${this._id} by user ${userId}. Total views: ${this.totalViews}`);
    }
    
    if (shouldSave) {
      await this.save();
    }
    
    return this.totalViews || 0;
  } catch (error) {
    console.error('❌ Error adding view:', error);
    return this.totalViews || 0;
  }
};

// FIXED: Method to get unique viewers count
ReelSchema.methods.getUniqueViewersCount = function() {
  if (!this.views || this.views.length === 0) return 0;
  
  const uniqueUsers = new Set();
  this.views.forEach(view => {
    if (view.user) {
      uniqueUsers.add(view.user.toString());
    }
  });
  
  return uniqueUsers.size;
};

// FIXED: Method to clean up old views (optional, for maintenance)
ReelSchema.methods.cleanupOldViews = async function(dayLimit = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dayLimit);
    
    const originalLength = this.views.length;
    this.views = this.views.filter(view => view.viewedAt > cutoffDate);
    
    if (this.views.length !== originalLength) {
      console.log(`🧹 Cleaned up ${originalLength - this.views.length} old views for reel ${this._id}`);
      await this.save();
    }
    
    return this.views.length;
  } catch (error) {
    console.error('Error cleaning up old views:', error);
    return this.views.length;
  }
};

// FIXED: Virtual for getting current views count (prioritizes totalViews)
ReelSchema.virtual('viewsCount').get(function() {
  // Use totalViews if available, otherwise fall back to views array length
  return this.totalViews || (this.views ? this.views.length : 0);
});

// Virtual for getting likes count
ReelSchema.virtual('likesCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Virtual for getting comments count
ReelSchema.virtual('commentsCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// ADDED: Virtual for engagement rate calculation
ReelSchema.virtual('engagementRate').get(function() {
  const views = this.viewsCount;
  if (views === 0) return 0;
  
  const likes = this.likesCount;
  const comments = this.commentsCount;
  const shares = this.shares || 0;
  
  return ((likes + comments + shares) / views * 100).toFixed(2);
});

// FIXED: Pre-save middleware to ensure totalViews is always correct
ReelSchema.pre('save', function(next) {
  try {
    // Only update totalViews if it's not already set correctly
    if (this.isModified('views') || this.totalViews === undefined) {
      const uniqueUsers = new Set();
      if (this.views && Array.isArray(this.views)) {
        this.views.forEach(view => {
          if (view.user) {
            uniqueUsers.add(view.user.toString());
          }
        });
      }
      this.totalViews = uniqueUsers.size;
    }
    next();
  } catch (error) {
    console.error('Error in pre-save middleware:', error);
    next(error);
  }
});

// Ensure virtual fields are serialized
ReelSchema.set('toJSON', { virtuals: true });
ReelSchema.set('toObject', { virtuals: true });

// ADDED: Static method to get trending reels
ReelSchema.statics.getTrending = function(limit = 20, timeframe = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframe);
  
  return this.aggregate([
    { $match: { isActive: true, createdAt: { $gte: cutoffDate } } },
    {
      $addFields: {
        likesCount: { $size: '$likes' },
        commentsCount: { $size: '$comments' },
        viewsCount: { $ifNull: ['$totalViews', { $size: '$views' }] },
        engagementScore: {
          $add: [
            { $size: '$likes' },
            { $multiply: [{ $size: '$comments' }, 2] },
            { $divide: [{ $ifNull: ['$totalViews', { $size: '$views' }] }, 10] },
            { $multiply: [{ $ifNull: ['$shares', 0] }, 3] }
          ]
        }
      }
    },
    { $sort: { engagementScore: -1, createdAt: -1 } },
    { $limit: limit }
  ]);
};

// Create the Reel model
const Reel = mongoose.model('Reel', ReelSchema);
console.log('✅ Reel model created successfully with improved view tracking');

module.exports = Reel;