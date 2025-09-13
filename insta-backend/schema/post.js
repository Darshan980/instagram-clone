// Post Schema
const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caption: {
    type: String,
    maxlength: 2200,
    trim: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  cloudinaryId: {
    type: String,
    required: false // Make this optional for fallback scenarios
  },
  likes: [ {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [ {
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
  location: {
    type: String,
    maxlength: 100
  },
  tags: [ {
    type: String,
    maxlength: 50
  }]
}, {
  timestamps: true
});
module.exports = mongoose.model('Post', postSchema);