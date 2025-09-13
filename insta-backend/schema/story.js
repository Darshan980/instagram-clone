// Story Schema with enhanced user tracking
const mongoose = require("mongoose");

const storySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mediaUrl: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    required: true,
    default: 'image'
  },
  caption: {
    type: String,
    maxlength: 500,
    default: ''
  },
  cloudinaryId: {
    type: String,
    required: false
  },
  views: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    }
  }
}, {
  timestamps: true
});

// Story indexes for performance
storySchema.index({ userId: 1, createdAt: -1 });
storySchema.index({ expiresAt: 1 });
storySchema.index({ isActive: 1, expiresAt: 1 });

// Instance method to add view
storySchema.methods.addView = async function(userId) {
  // Check if user already viewed this story
  const existingView = this.views.find(view => 
    view.userId.toString() === userId.toString()
  );

  if (!existingView) {
    this.views.push({ userId, viewedAt: new Date() });
    await this.save();
  }
  
  return this.views.length;
};

// Static method to cleanup expired stories (single, consolidated version)
storySchema.statics.cleanupExpiredStories = async function() {
  try {
    console.log('🧹 Starting story cleanup process...');
    
    // Find expired stories
    const expiredStories = await this.find({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { isActive: false }
      ]
    });

    console.log(`Found ${expiredStories.length} expired stories to cleanup`);

    // Check if Cloudinary is available
    let cloudinary = null;
    let isCloudinaryConfigured = false;
    
    try {
      // Try to import cloudinary utilities
      const cloudinaryUtils = require('../utils/cloudinary');
      cloudinary = cloudinaryUtils.cloudinary;
      isCloudinaryConfigured = cloudinaryUtils.isCloudinaryConfigured();
    } catch (error) {
      console.log('Cloudinary utilities not available, skipping media cleanup');
    }

    // Delete media from Cloudinary for expired stories (if configured)
    if (isCloudinaryConfigured && cloudinary) {
      for (const story of expiredStories) {
        if (story.cloudinaryId) {
          try {
            await cloudinary.uploader.destroy(story.cloudinaryId, {
              resource_type: story.mediaType === 'video' ? 'video' : 'image'
            });
            console.log(`Deleted Cloudinary media: ${story.cloudinaryId}`);
          } catch (error) {
            console.error(`Error deleting Cloudinary media ${story.cloudinaryId}:`, error);
            // Continue with cleanup even if individual media deletion fails
          }
        }
      }
    }

    // Delete expired stories from database
    const result = await this.deleteMany({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { isActive: false }
      ]
    });

    console.log(`🧹 Successfully cleaned up ${result.deletedCount} expired stories`);
    return result.deletedCount;
    
  } catch (error) {
    console.error('Error during story cleanup:', error);
    // Don't throw error to prevent breaking the API
    return 0;
  }
};

// Pre-save middleware to set expiration
storySchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

const Story = mongoose.model('Story', storySchema);

module.exports = Story;