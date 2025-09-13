const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Message, Conversation } = require('../schema/message'); // Fixed: Import both from schema
const User = require('../schema/user.js'); // Fixed: Import from schema folder like other routes
const { authenticateToken } = require('../middleware/auth');
const { uploadToCloudinary, isCloudinaryConfigured, createPlaceholderImageUrl } = require('../utils/cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Send a message (protected route)
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const senderId = req.user._id;

    // Validation
    if (!receiverId) {
      return res.status(400).json({ message: 'Receiver ID is required' });
    }

    if (!text && !req.file) {
      return res.status(400).json({ message: 'Message text or image is required' });
    }

    if (text && text.length > 1000) {
      return res.status(400).json({ message: 'Message text must be less than 1000 characters' });
    }

    // Check if receiver exists
    let receiver;
    try {
      receiver = await User.findById(receiverId);
    } catch (userError) {
      console.error('Error finding user:', userError);
      return res.status(500).json({ message: 'Error validating receiver' });
    }

    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Handle image upload if provided
    let imageUrl = null;
    let cloudinaryId = null;

    if (req.file) {
      try {
        if (isCloudinaryConfigured()) {
          const cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'instagram-clone/messages');
          imageUrl = cloudinaryResult.secure_url;
          cloudinaryId = cloudinaryResult.public_id;
        } else {
          imageUrl = createPlaceholderImageUrl();
        }
      } catch (uploadError) {
        console.error('Message image upload error:', uploadError);
        return res.status(400).json({ message: 'Failed to upload image' });
      }
    }

    // Create new message
    const newMessage = new Message({
      senderId,
      receiverId,
      text: text || '',
      imageUrl,
      cloudinaryId
    });

    await newMessage.save();

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, receiverId],
        lastMessage: newMessage._id,
        lastMessageAt: new Date()
      });
    } else {
      conversation.lastMessage = newMessage._id;
      conversation.lastMessageAt = new Date();
    }

    await conversation.save();

    // Populate message for response
    await newMessage.populate('senderId', 'username fullName profilePicture');
    await newMessage.populate('receiverId', 'username fullName profilePicture');

    res.status(201).json({
      message: 'Message sent successfully',
      data: newMessage
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error while sending message' });
  }
});

// Get messages between current user and another user (protected route)
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Check if other user exists
    let otherUser;
    try {
      otherUser = await User.findById(otherUserId);
    } catch (userError) {
      console.error('Error finding user:', userError);
      return res.status(500).json({ message: 'Error validating user' });
    }

    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get messages between the two users
    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    })
    .populate('senderId', 'username fullName profilePicture')
    .populate('receiverId', 'username fullName profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    // Mark messages as read (messages sent to current user)
    await Message.updateMany(
      {
        senderId: otherUserId,
        receiverId: currentUserId,
        isRead: false
      },
      { isRead: true }
    );

    const totalMessages = await Message.countDocuments({
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    });
    const totalPages = Math.ceil(totalMessages / limit);

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      otherUser: {
        id: otherUser._id,
        username: otherUser.username,
        fullName: otherUser.fullName,
        profilePicture: otherUser.profilePicture
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalMessages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error while fetching messages' });
  }
});

// Mark messages as read (protected route)
router.put('/:userId/read', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;

    // Mark all unread messages from the other user as read
    const result = await Message.updateMany(
      {
        senderId: otherUserId,
        receiverId: currentUserId,
        isRead: false
      },
      { isRead: true }
    );

    res.json({
      message: 'Messages marked as read',
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({ message: 'Server error while marking messages as read' });
  }
});

// Get unread message count (protected route)
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const unreadCount = await Message.countDocuments({
      receiverId: userId,
      isRead: false
    });

    res.json({ unreadCount });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error while fetching unread count' });
  }
});

// Delete a message (protected route - only sender can delete)
router.delete('/:messageId', authenticateToken, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender
    if (!message.senderId.equals(userId)) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    // Delete image from Cloudinary if it exists
    if (message.cloudinaryId && isCloudinaryConfigured()) {
      try {
        await cloudinary.uploader.destroy(message.cloudinaryId);
      } catch (error) {
        console.error('Error deleting message image from Cloudinary:', error);
      }
    }

    await Message.findByIdAndDelete(messageId);

    res.json({ message: 'Message deleted successfully' });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error while deleting message' });
  }
});

// Search messages (protected route)
router.get('/search/:query', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const searchQuery = req.params.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Search in messages where user is either sender or receiver
    const messages = await Message.find({
      $and: [
        {
          $or: [
            { senderId: userId },
            { receiverId: userId }
          ]
        },
        {
          text: { $regex: searchQuery, $options: 'i' }
        }
      ]
    })
    .populate('senderId', 'username fullName profilePicture')
    .populate('receiverId', 'username fullName profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const totalResults = await Message.countDocuments({
      $and: [
        {
          $or: [
            { senderId: userId },
            { receiverId: userId }
          ]
        },
        {
          text: { $regex: searchQuery, $options: 'i' }
        }
      ]
    });

    const totalPages = Math.ceil(totalResults / limit);

    res.json({
      messages,
      searchQuery,
      pagination: {
        currentPage: page,
        totalPages,
        totalResults,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ message: 'Server error while searching messages' });
  }
});

module.exports = router;