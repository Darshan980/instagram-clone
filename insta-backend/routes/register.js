const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../schema/user.js');
const { generateToken } = require('../middleware/auth.js');

const router = express.Router();

// Input validation helper
const validateRegistrationInput = (username, email, password, fullName) => {
  const errors = [];

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    errors.push('Username is required');
  } else if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  } else if (username.length > 30) {
    errors.push('Username must be less than 30 characters');
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Please provide a valid email address');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  } else if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
    errors.push('Full name is required');
  } else if (fullName.length > 50) {
    errors.push('Full name must be less than 50 characters');
  }

  return errors;
};

// POST /api/auth/register - Register Route
router.post('/', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    // Input validation
    const validationErrors = validateRegistrationInput(username, email, password, fullName);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Normalize inputs
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();
    const trimmedFullName = fullName.trim();

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { username: normalizedUsername }
      ]
    });

    if (existingUser) {
      const field = existingUser.email === normalizedEmail ? 'email' : 'username';
      return res.status(400).json({ 
        message: `This ${field} is already registered`,
        field: field
      });
    }

    // Hash password with higher salt rounds for better security
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      fullName: trimmedFullName,
      profilePicture: '', // Default empty profile picture
      bio: '', // Default empty bio
      followers: [],
      following: [],
      posts: []
    });

    await newUser.save();

    // Generate token
    const token = generateToken(newUser._id);

    // Return user data (without password) and token
    const userResponse = {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      fullName: newUser.fullName,
      profilePicture: newUser.profilePicture,
      bio: newUser.bio,
      followers: newUser.followers,
      following: newUser.following,
      posts: newUser.posts,
      createdAt: newUser.createdAt
    };

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `This ${duplicateField} is already registered`,
        field: duplicateField
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors
      });
    }
    
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// POST /api/auth/register/check-availability - Check username/email availability
router.post('/check-availability', async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!username && !email) {
      return res.status(400).json({ 
        message: 'Please provide username or email to check' 
      });
    }

    const query = {};
    if (username) query.username = username.toLowerCase().trim();
    if (email) query.email = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      $or: Object.entries(query).map(([key, value]) => ({ [key]: value }))
    });

    if (existingUser) {
      const unavailableField = existingUser.username === query.username ? 'username' : 'email';
      return res.json({
        available: false,
        field: unavailableField,
        message: `This ${unavailableField} is already taken`
      });
    }

    res.json({
      available: true,
      message: 'Available'
    });

  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({ message: 'Server error during availability check' });
  }
});

module.exports = router;