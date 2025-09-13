const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username must be less than 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Don't include password in queries by default
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [50, 'Full name must be less than 50 characters']
  },
  profilePicture: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: '',
    maxlength: [150, 'Bio must be less than 150 characters']
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  stories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Story'
  }],
  
  // Enhanced Privacy & Security Settings
  isPrivate: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Blocking System
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Users who blocked this user (for efficient queries)
  blockedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Enhanced Account Settings
  settings: {
    notifications: {
      likes: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      follows: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      messages: { type: Boolean, default: true }
    },
    privacy: {
      showOnlineStatus: { type: Boolean, default: true },
      allowTagging: { type: Boolean, default: true },
      allowMessagesFromStrangers: { type: Boolean, default: false }
    },
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      loginNotifications: { type: Boolean, default: true }
    },
    // Store deactivation reason for analytics
    deactivationReason: {
      type: String,
      default: ''
    }
  },
  
  // Enhanced Profile Info
  website: {
    type: String,
    default: '',
    maxlength: [100, 'Website URL must be less than 100 characters']
  },
  phoneNumber: {
    type: String,
    default: '',
    maxlength: [20, 'Phone number must be less than 20 characters']
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', ''],
    default: ''
  },
  
  // Activity Tracking
  lastActive: {
    type: Date,
    default: Date.now
  },
  
  // Enhanced Security Tracking
  lastPasswordChange: {
    type: Date,
    default: Date.now
  },
  emailChanges: [{
    oldEmail: String,
    newEmail: String,
    changedAt: { type: Date, default: Date.now },
    verifiedAt: Date
  }],
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: Date,
  
  // Account Status with enhanced options
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'deactivated', 'deleted', 'pending_verification'],
    default: 'active'
  },
  
  // Enhanced Deactivation/Deletion tracking
  deactivatedAt: Date,
  deactivationCount: { type: Number, default: 0 }, // Track how many times deactivated
  deletionScheduledFor: Date, // For soft delete with grace period
  deletionReason: String,
  
  // Email verification (for email changes)
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  pendingEmail: String, // Store pending email during verification process
  
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.loginAttempts;
      delete ret.lockedUntil;
      delete ret.emailVerificationToken;
      delete ret.emailVerificationExpires;
      return ret;
    }
  }
});

// Enhanced indexes for better query performance
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ fullName: 'text', username: 'text' });
userSchema.index({ createdAt: -1 });
userSchema.index({ accountStatus: 1 });
userSchema.index({ isPrivate: 1 });
userSchema.index({ blockedUsers: 1 });
userSchema.index({ blockedBy: 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ 'settings.notifications.follows': 1 });

// Virtual for follower count
userSchema.virtual('followerCount').get(function() {
  return this.followers.length;
});

// Virtual for following count
userSchema.virtual('followingCount').get(function() {
  return this.following.length;
});

// Virtual for post count
userSchema.virtual('postCount').get(function() {
  return this.posts.length;
});

// Virtual to check if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockedUntil && this.lockedUntil > Date.now());
});

// Pre-save middleware to update lastActive
userSchema.pre('save', function(next) {
  if (this.isNew || this.isModified()) {
    this.lastActive = new Date();
  }
  next();
});

// Static method to find user by username or email
userSchema.statics.findByUsernameOrEmail = function(identifier) {
  return this.findOne({
    $or: [
      { username: identifier.toLowerCase() },
      { email: identifier.toLowerCase() }
    ],
    accountStatus: 'active'
  });
};

// Static method to find active users (not blocked/deleted)
userSchema.statics.findActiveUsers = function(query = {}) {
  return this.find({
    ...query,
    accountStatus: 'active',
    isActive: true
  });
};

// Instance method to follow another user (with privacy checks)
userSchema.methods.follow = async function(userId) {
  // Check if user is blocked
  if (this.isUserBlocked(userId) || this.isBlockedBy(userId)) {
    throw new Error('Cannot follow this user');
  }
  
  if (!this.following.includes(userId)) {
    this.following.push(userId);
    await this.save();
    
    // Add this user to the other user's followers
    await this.constructor.findByIdAndUpdate(userId, {
      $addToSet: { followers: this._id }
    });
  }
};

// Instance method to unfollow another user
userSchema.methods.unfollow = async function(userId) {
  this.following.pull(userId);
  await this.save();
  
  // Remove this user from the other user's followers
  await this.constructor.findByIdAndUpdate(userId, {
    $pull: { followers: this._id }
  });
};

// Instance method to check if following another user
userSchema.methods.isFollowing = function(userId) {
  return this.following.includes(userId);
};

// Instance method to block a user
userSchema.methods.blockUser = async function(userId) {
  if (userId.toString() === this._id.toString()) {
    throw new Error('Cannot block yourself');
  }
  
  if (!this.blockedUsers.includes(userId)) {
    // Add to blocked list
    this.blockedUsers.push(userId);
    
    // Remove from followers/following
    this.followers.pull(userId);
    this.following.pull(userId);
    
    await this.save();
    
    // Update the blocked user's records
    await this.constructor.findByIdAndUpdate(userId, {
      $addToSet: { blockedBy: this._id },
      $pull: { 
        followers: this._id,
        following: this._id
      }
    });
  }
};

// Instance method to unblock a user
userSchema.methods.unblockUser = async function(userId) {
  this.blockedUsers.pull(userId);
  await this.save();
  
  // Remove from the other user's blockedBy list
  await this.constructor.findByIdAndUpdate(userId, {
    $pull: { blockedBy: this._id }
  });
};

// Instance method to check if user is blocked
userSchema.methods.isUserBlocked = function(userId) {
  return this.blockedUsers.includes(userId);
};

// Instance method to check if blocked by user
userSchema.methods.isBlockedBy = function(userId) {
  return this.blockedBy.includes(userId);
};

// Instance method to check if can view profile
userSchema.methods.canViewProfile = function(viewerId) {
  // Own profile - always can view
  if (this._id.toString() === viewerId.toString()) {
    return true;
  }
  
  // Blocked users cannot view
  if (this.isUserBlocked(viewerId) || this.isBlockedBy(viewerId)) {
    return false;
  }
  
  // Public accounts - anyone can view
  if (!this.isPrivate) {
    return true;
  }
  
  // Private accounts - only followers can view
  return this.followers.includes(viewerId);
};

// Enhanced deactivate account method
userSchema.methods.deactivateAccount = async function() {
  this.accountStatus = 'deactivated';
  this.deactivatedAt = new Date();
  this.deactivationCount = (this.deactivationCount || 0) + 1;
  this.isActive = false;
  await this.save();
};

// Instance method to reactivate account
userSchema.methods.reactivateAccount = async function() {
  this.accountStatus = 'active';
  this.deactivatedAt = undefined;
  this.isActive = true;
  await this.save();
};

// Instance method to schedule account deletion
userSchema.methods.scheduleAccountDeletion = async function(days = 30, reason = '') {
  this.accountStatus = 'deleted';
  this.deletionScheduledFor = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
  this.deletionReason = reason;
  this.isActive = false;
  await this.save();
};

// Instance method to cancel account deletion
userSchema.methods.cancelAccountDeletion = async function() {
  this.accountStatus = 'active';
  this.deletionScheduledFor = undefined;
  this.deletionReason = undefined;
  this.isActive = true;
  await this.save();
};

// Instance method to increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockedUntil && this.lockedUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockedUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // After 5 attempts, lock for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockedUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockedUntil: 1 }
  });
};

// Instance method to log email change
userSchema.methods.logEmailChange = function(oldEmail, newEmail) {
  this.emailChanges.push({
    oldEmail: oldEmail,
    newEmail: newEmail,
    changedAt: new Date()
  });
};

// Instance method to verify pending email
userSchema.methods.verifyPendingEmail = async function() {
  if (this.pendingEmail && this.emailVerificationToken) {
    const oldEmail = this.email;
    this.logEmailChange(oldEmail, this.pendingEmail);
    this.email = this.pendingEmail;
    this.pendingEmail = undefined;
    this.emailVerificationToken = undefined;
    this.emailVerificationExpires = undefined;
    await this.save();
  }
};

// Instance method to check notification preferences
userSchema.methods.shouldReceiveNotification = function(type) {
  const notificationSettings = this.settings?.notifications || {};
  
  switch (type) {
    case 'like':
    case 'likes':
      return notificationSettings.likes !== false;
    case 'comment':
    case 'comments':
      return notificationSettings.comments !== false;
    case 'follow':
    case 'follows':
      return notificationSettings.follows !== false;
    case 'mention':
    case 'mentions':
      return notificationSettings.mentions !== false;
    case 'message':
    case 'messages':
      return notificationSettings.messages !== false;
    default:
      return true; // Default to sending notifications for unknown types
  }
};

const User = mongoose.model('User', userSchema);

module.exports = User;