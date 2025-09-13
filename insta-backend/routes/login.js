const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../schema/user.js');
const { generateToken, authenticateToken } = require('../middleware/auth.js');

const router = express.Router();

// POST /api/auth/login - Login Route
router.post('/', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without password) and token
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      profilePicture: user.profilePicture,
      bio: user.bio,
      followers: user.followers,
      following: user.following,
      posts: user.posts
    };

    res.json({
      message: 'Login successful',
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// GET /api/auth/login/me - Get current user (protected route)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userResponse = {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      fullName: req.user.fullName,
      profilePicture: req.user.profilePicture,
      bio: req.user.bio,
      followers: req.user.followers,
      following: req.user.following,
      posts: req.user.posts
    };

    res.json({ user: userResponse });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;