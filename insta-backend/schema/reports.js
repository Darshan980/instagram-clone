const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return this.reportType === 'user'; }
  },
  reportedPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: function() { return this.reportType === 'post'; }
  },
  reportedComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    required: function() { return this.reportType === 'comment'; }
  },
  reportType: {
    type: String,
    enum: ['user', 'post', 'comment', 'story'],
    required: true
  },
  reason: {
    type: String,
    enum: [
      'spam',
      'harassment',
      'hate_speech',
      'violence',
      'nudity',
      'copyright',
      'fake_news',
      'inappropriate_content',
      'impersonation',
      'self_harm',
      'terrorism',
      'other'
    ],
    required: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description must be less than 500 characters'],
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin user
  },
  reviewedAt: Date,
  actionTaken: {
    type: String,
    enum: ['none', 'warning', 'content_removed', 'user_suspended', 'user_banned'],
    default: 'none'
  },
  evidence: [{
    type: String, // URLs to screenshots or additional evidence
  }],
  duplicateOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
reportSchema.index({ reporter: 1 });
reportSchema.index({ reportedUser: 1 });
reportSchema.index({ reportedPost: 1 });
reportSchema.index({ reportType: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ priority: 1 });
reportSchema.index({ reason: 1 });
reportSchema.index({ createdAt: -1 });

// Compound indexes
reportSchema.index({ status: 1, priority: -1, createdAt: -1 });
reportSchema.index({ reportType: 1, status: 1 });

// Prevent duplicate reports from same user for same content
reportSchema.index({ 
  reporter: 1, 
  reportedUser: 1, 
  reportedPost: 1, 
  reportedComment: 1 
}, { 
  unique: true,
  partialFilterExpression: { status: { $ne: 'dismissed' } }
});

// Virtual for getting reported content info
reportSchema.virtual('reportedContent', {
  refPath: function() {
    if (this.reportType === 'user') return 'reportedUser';
    if (this.reportType === 'post') return 'reportedPost';
    if (this.reportType === 'comment') return 'reportedComment';
    return null;
  },
  localField: function() {
    if (this.reportType === 'user') return 'reportedUser';
    if (this.reportType === 'post') return 'reportedPost';
    if (this.reportType === 'comment') return 'reportedComment';
    return null;
  },
  foreignField: '_id',
  justOne: true
});

// Static method to create a new report
reportSchema.statics.createReport = async function(reportData) {
  const { reporter, reportType, reason, description } = reportData;
  
  // Validation
  if (!reporter || !reportType || !reason) {
    throw new Error('Reporter, reportType, and reason are required');
  }
  
  // Check if user is reporting their own content
  if (reportType === 'user' && reportData.reportedUser.toString() === reporter.toString()) {
    throw new Error('Cannot report yourself');
  }
  
  // Set priority based on reason
  let priority = 'medium';
  if (['violence', 'self_harm', 'terrorism'].includes(reason)) {
    priority = 'urgent';
  } else if (['harassment', 'hate_speech', 'nudity'].includes(reason)) {
    priority = 'high';
  } else if (['spam', 'copyright'].includes(reason)) {
    priority = 'low';
  }
  
  const report = new this({
    ...reportData,
    priority,
    description: description || ''
  });
  
  return report.save();
};

// Static method to get reports for admin review
reportSchema.statics.getReportsForReview = function(options = {}) {
  const {
    status = 'pending',
    priority,
    reportType,
    page = 1,
    limit = 20
  } = options;
  
  const query = { status };
  
  if (priority) query.priority = priority;
  if (reportType) query.reportType = reportType;
  
  const skip = (page - 1) * limit;
  
  return this.find(query)
    .populate('reporter', 'username fullName profilePicture')
    .populate('reportedUser', 'username fullName profilePicture')
    .populate('reportedPost', 'caption imageUrl')
    .populate('reviewedBy', 'username fullName')
    .sort({ priority: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Instance method to resolve report
reportSchema.methods.resolveReport = async function(adminId, actionTaken, adminNotes) {
  this.status = 'resolved';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.actionTaken = actionTaken;
  this.adminNotes = adminNotes;
  
  return this.save();
};

// Instance method to dismiss report
reportSchema.methods.dismissReport = async function(adminId, adminNotes) {
  this.status = 'dismissed';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.adminNotes = adminNotes;
  
  return this.save();
};

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;