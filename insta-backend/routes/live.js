const express = require('express');
const { authenticateToken } = require('../middleware/auth.js');
const LiveStream = require('../schema/live.js');
const User = require('../schema/user.js');
const { createNotification } = require('../schema/notification.js');
const crypto = require('crypto');

const router = express.Router();

// ============================
// CREATE LIVE STREAM
// ============================
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { title, description, isPrivate, allowComments, category, tags } = req.body;
    const userId = req.user._id;

    console.log(`🔴 Starting live stream for user: ${userId}`);

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Stream title is required'
      });
    }

    // Check if user already has an active stream
    const existingStream = await LiveStream.findOne({
      user: userId,
      status: 'live'
    });

    if (existingStream) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active live stream. Please end it before starting a new one.'
      });
    }

    // Generate unique stream key
    const streamKey = crypto.randomBytes(16).toString('hex');

    // Create new live stream
    const liveStream = new LiveStream({
      user: userId,
      title: title.trim(),
      description: description?.trim() || '',
      isPrivate: isPrivate || false,
      allowComments: allowComments !== false,
      category: category || 'general',
      tags: tags || [],
      streamKey: streamKey,
      streamUrl: `${process.env.BASE_URL || 'http://localhost:5000'}/live/${streamKey}`,
      status: 'live',
      startedAt: new Date()
    });

    await liveStream.save();

    // Populate user data
    await liveStream.populate('user', 'username fullName profilePicture');

    console.log(`✅ Live stream created: ${liveStream._id}`);

    // Notify followers
    try {
      const user = await User.findById(userId).select('followers username');
      if (user && user.followers && user.followers.length > 0) {
        // Create notifications for followers (limit to prevent overload)
        const followerIds = user.followers.slice(0, 100); // Notify first 100 followers
        
        for (const followerId of followerIds) {
          await createNotification(
            followerId,
            userId,
            'live',
            `${user.username} is live now: ${title}`,
            { streamId: liveStream._id }
          ).catch(err => console.error('Notification error:', err));
        }
      }
    } catch (notificationError) {
      console.error('Error notifying followers:', notificationError);
    }

    res.status(201).json({
      success: true,
      message: 'Live stream started successfully',
      data: {
        stream: liveStream
      }
    });

  } catch (error) {
    console.error('Start live stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while starting live stream'
    });
  }
});

// ============================
// GET ALL ACTIVE LIVE STREAMS
// ============================
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log('📺 Fetching active live streams');

    const streams = await LiveStream.find({ status: 'live' })
      .populate('user', 'username fullName profilePicture followers')
      .sort({ currentViewerCount: -1, startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalStreams = await LiveStream.countDocuments({ status: 'live' });
    const totalPages = Math.ceil(totalStreams / limit);

    // Add additional info
    const currentUserId = req.user._id.toString();
    const streamsWithInfo = streams.map(stream => ({
      ...stream,
      isOwner: stream.user._id.toString() === currentUserId,
      isFollowing: stream.user.followers?.some(f => f.toString() === currentUserId) || false,
      likeCount: stream.likes?.length || 0,
      commentCount: stream.comments?.length || 0
    }));

    res.json({
      success: true,
      data: {
        streams: streamsWithInfo,
        pagination: {
          currentPage: page,
          totalPages,
          totalStreams,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit
        }
      }
    });

  } catch (error) {
    console.error('Get active streams error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching live streams'
    });
  }
});

// ============================
// GET SINGLE LIVE STREAM
// ============================
router.get('/:streamId', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const userId = req.user._id;

    console.log(`📺 Fetching live stream: ${streamId}`);

    const stream = await LiveStream.findById(streamId)
      .populate('user', 'username fullName profilePicture followers')
      .populate('comments.user', 'username fullName profilePicture')
      .lean();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Live stream not found'
      });
    }

    // Check privacy
    if (stream.isPrivate && stream.user._id.toString() !== userId.toString()) {
      if (!stream.allowedViewers?.some(v => v.toString() === userId.toString())) {
        return res.status(403).json({
          success: false,
          error: 'This is a private stream'
        });
      }
    }

    // Add viewer if stream is live
    if (stream.status === 'live') {
      await LiveStream.findById(streamId).then(s => s.addViewer(userId));
    }

    const streamWithInfo = {
      ...stream,
      isOwner: stream.user._id.toString() === userId.toString(),
      isFollowing: stream.user.followers?.some(f => f.toString() === userId.toString()) || false,
      hasLiked: stream.likes?.some(l => l.toString() === userId.toString()) || false,
      likeCount: stream.likes?.length || 0,
      commentCount: stream.comments?.length || 0
    };

    res.json({
      success: true,
      data: {
        stream: streamWithInfo
      }
    });

  } catch (error) {
    console.error('Get live stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching live stream'
    });
  }
});

// ============================
// JOIN LIVE STREAM (Add Viewer)
// ============================
router.post('/:streamId/join', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const userId = req.user._id;

    const stream = await LiveStream.findById(streamId);

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Live stream not found'
      });
    }

    if (stream.status !== 'live') {
      return res.status(400).json({
        success: false,
        error: 'This stream is not live'
      });
    }

    await stream.addViewer(userId);

    console.log(`👤 User ${userId} joined stream ${streamId}`);

    res.json({
      success: true,
      message: 'Joined stream successfully',
      data: {
        currentViewerCount: stream.currentViewerCount
      }
    });

  } catch (error) {
    console.error('Join stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while joining stream'
    });
  }
});

// ============================
// LEAVE LIVE STREAM (Remove Viewer)
// ============================
router.post('/:streamId/leave', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const userId = req.user._id;

    const stream = await LiveStream.findById(streamId);

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Live stream not found'
      });
    }

    await stream.removeViewer(userId);

    console.log(`👋 User ${userId} left stream ${streamId}`);

    res.json({
      success: true,
      message: 'Left stream successfully',
      data: {
        currentViewerCount: stream.currentViewerCount
      }
    });

  } catch (error) {
    console.error('Leave stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while leaving stream'
    });
  }
});

// ============================
// LIKE LIVE STREAM
// ============================
router.post('/:streamId/like', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const userId = req.user._id;

    const stream = await LiveStream.findById(streamId);

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Live stream not found'
      });
    }

    const hasLiked = stream.likes.includes(userId);

    if (hasLiked) {
      // Unlike
      stream.likes = stream.likes.filter(id => id.toString() !== userId.toString());
      await stream.save();

      console.log(`💔 User ${userId} unliked stream ${streamId}`);

      res.json({
        success: true,
        message: 'Stream unliked',
        data: {
          hasLiked: false,
          likeCount: stream.likes.length
        }
      });
    } else {
      // Like
      stream.likes.push(userId);
      await stream.save();

      console.log(`❤️ User ${userId} liked stream ${streamId}`);

      // Notify stream owner
      if (stream.user.toString() !== userId.toString()) {
        try {
          await createNotification(
            stream.user,
            userId,
            'like',
            `${req.user.username} liked your live stream`,
            { streamId: stream._id }
          );
        } catch (notificationError) {
          console.error('Notification error:', notificationError);
        }
      }

      res.json({
        success: true,
        message: 'Stream liked',
        data: {
          hasLiked: true,
          likeCount: stream.likes.length
        }
      });
    }

  } catch (error) {
    console.error('Like stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while liking stream'
    });
  }
});

// ============================
// COMMENT ON LIVE STREAM
// ============================
router.post('/:streamId/comment', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Comment text is required'
      });
    }

    const stream = await LiveStream.findById(streamId);

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Live stream not found'
      });
    }

    if (!stream.allowComments) {
      return res.status(403).json({
        success: false,
        error: 'Comments are disabled for this stream'
      });
    }

    const comment = {
      user: userId,
      text: text.trim(),
      createdAt: new Date()
    };

    stream.comments.push(comment);
    await stream.save();

    // Populate the comment user data
    await stream.populate('comments.user', 'username fullName profilePicture');
    const newComment = stream.comments[stream.comments.length - 1];

    console.log(`💬 User ${userId} commented on stream ${streamId}`);

    res.json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comment: newComment,
        commentCount: stream.comments.length
      }
    });

  } catch (error) {
    console.error('Comment on stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while adding comment'
    });
  }
});

// ============================
// GET STREAM COMMENTS
// ============================
router.get('/:streamId/comments', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    const stream = await LiveStream.findById(streamId)
      .populate('comments.user', 'username fullName profilePicture')
      .lean();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Live stream not found'
      });
    }

    const comments = stream.comments
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(skip, skip + limit);

    res.json({
      success: true,
      data: {
        comments,
        totalComments: stream.comments.length,
        hasMore: skip + limit < stream.comments.length
      }
    });

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching comments'
    });
  }
});

// ============================
// END LIVE STREAM
// ============================
router.post('/:streamId/end', authenticateToken, async (req, res) => {
  try {
    const { streamId } = req.params;
    const userId = req.user._id;

    const stream = await LiveStream.findById(streamId);

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Live stream not found'
      });
    }

    // Check if user is the owner
    if (stream.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You can only end your own streams'
      });
    }

    if (stream.status !== 'live') {
      return res.status(400).json({
        success: false,
        error: 'Stream is not live'
      });
    }

    await stream.endStream();

    console.log(`🛑 Live stream ended: ${streamId}`);

    res.json({
      success: true,
      message: 'Live stream ended successfully',
      data: {
        stream: {
          _id: stream._id,
          status: stream.status,
          duration: stream.duration,
          peakViewerCount: stream.peakViewerCount,
          totalViews: stream.totalViews,
          likeCount: stream.likes.length,
          commentCount: stream.comments.length
        }
      }
    });

  } catch (error) {
    console.error('End stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while ending stream'
    });
  }
});

// ============================
// GET USER'S STREAMS (History)
// ============================
router.get('/user/:userId/streams', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const streams = await LiveStream.find({ user: userId })
      .populate('user', 'username fullName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalStreams = await LiveStream.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalStreams / limit);

    const streamsWithInfo = streams.map(stream => ({
      ...stream,
      likeCount: stream.likes?.length || 0,
      commentCount: stream.comments?.length || 0
    }));

    res.json({
      success: true,
      data: {
        streams: streamsWithInfo,
        pagination: {
          currentPage: page,
          totalPages,
          totalStreams,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit
        }
      }
    });

  } catch (error) {
    console.error('Get user streams error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching user streams'
    });
  }
});

// ============================
// GET CURRENT USER'S ACTIVE STREAM
// ============================
router.get('/my/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const stream = await LiveStream.findOne({
      user: userId,
      status: 'live'
    })
    .populate('user', 'username fullName profilePicture')
    .lean();

    if (!stream) {
      return res.json({
        success: true,
        data: {
          stream: null,
          hasActiveStream: false
        }
      });
    }

    res.json({
      success: true,
      data: {
        stream: {
          ...stream,
          likeCount: stream.likes?.length || 0,
          commentCount: stream.comments?.length || 0
        },
        hasActiveStream: true
      }
    });

  } catch (error) {
    console.error('Get my active stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching active stream'
    });
  }
});

module.exports = router;
