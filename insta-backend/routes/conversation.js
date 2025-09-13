const express = require('express');
const router = express.Router();
const { Message, Conversation } = require('../schema/message');
const { authenticateToken } = require('../middleware/auth');

// Get conversations for current user (protected route)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const conversations = await Conversation.find({
      participants: userId
    })
    .populate('participants', 'username fullName profilePicture')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(limit);

    // Format conversations to show the other participant
    const formattedConversations = conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => 
        p._id.toString() !== userId.toString()
      );

      return {
        _id: conv._id,
        participant: otherParticipant,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        updatedAt: conv.updatedAt
      };
    });

    const totalConversations = await Conversation.countDocuments({
      participants: userId
    });
    const totalPages = Math.ceil(totalConversations / limit);

    res.json({
      conversations: formattedConversations,
      pagination: {
        currentPage: page,
        totalPages,
        totalConversations,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error while fetching conversations' });
  }
});

module.exports = router;