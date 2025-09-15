const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../schema/user.js');
const { generateToken, authenticateToken } = require('../middleware/auth.js');

const router = express.Router();

// Enhanced logging utility
const logDebug = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] AUTH DEBUG: ${message}`);
  if (data) {
    console.log(`[${timestamp}] AUTH DATA:`, JSON.stringify(data, null, 2));
  }
};

const logError = (message, error = null) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] AUTH ERROR: ${message}`);
  if (error) {
    console.error(`[${timestamp}] ERROR DETAILS:`, error);
    if (error.stack) {
      console.error(`[${timestamp}] ERROR STACK:`, error.stack);
    }
  }
};

// Input validation helper with enhanced logging
const validateRegistrationInput = (username, email, password, fullName) => {
  logDebug('Validating registration input', { 
    username: username ? `${username.substring(0, 3)}***` : null,
    email: email ? `${email.substring(0, 3)}***` : null,
    passwordLength: password ? password.length : 0,
    fullName: fullName ? `${fullName.substring(0, 3)}***` : null
  });

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

  logDebug(`Validation completed with ${errors.length} errors`, { errors });
  return errors;
};

// POST /api/auth/register - Register Route with Enhanced Debug
router.post('/register', async (req, res) => {
  const startTime = Date.now();
  logDebug('Registration attempt started', { 
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    bodyKeys: Object.keys(req.body || {})
  });

  try {
    const { username, email, password, fullName } = req.body;
    
    logDebug('Request body received', {
      hasUsername: !!username,
      hasEmail: !!email,
      hasPassword: !!password,
      hasFullName: !!fullName,
      usernameType: typeof username,
      emailType: typeof email,
      passwordType: typeof password,
      fullNameType: typeof fullName
    });

    // Input validation
    const validationErrors = validateRegistrationInput(username, email, password, fullName);
    if (validationErrors.length > 0) {
      logDebug('Validation failed', { errors: validationErrors });
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Normalize inputs
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();
    const trimmedFullName = fullName.trim();

    logDebug('Inputs normalized', {
      originalUsername: username,
      normalizedUsername: normalizedUsername,
      originalEmail: email,
      normalizedEmail: normalizedEmail
    });

    // Check if user already exists
    logDebug('Checking for existing user...');
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { username: normalizedUsername }
      ]
    });

    if (existingUser) {
      const field = existingUser.email === normalizedEmail ? 'email' : 'username';
      logDebug('User already exists', { 
        field, 
        existingUserId: existingUser._id,
        existingUsername: existingUser.username,
        existingEmail: existingUser.email.substring(0, 3) + '***'
      });
      return res.status(400).json({ 
        message: `This ${field} is already registered`,
        field: field
      });
    }

    logDebug('No existing user found, proceeding with password hashing...');

    // Hash password with higher salt rounds for better security
    const saltRounds = 12;
    logDebug(`Starting password hash with ${saltRounds} salt rounds`);
    
    if (!password || password.length === 0) {
      logError('Password is empty or null before hashing');
      return res.status(400).json({ message: 'Password is required and cannot be empty' });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Verify the hash was created successfully
    if (!hashedPassword || hashedPassword.length < 20) {
      logError('Password hashing failed or produced invalid hash', {
        passwordProvided: !!password,
        passwordLength: password ? password.length : 0,
        hashProduced: !!hashedPassword,
        hashLength: hashedPassword ? hashedPassword.length : 0
      });
      return res.status(500).json({ message: 'Password processing failed' });
    }

    logDebug('Password hashed successfully', { 
      originalLength: password.length,
      hashedLength: hashedPassword.length,
      hashPrefix: hashedPassword.substring(0, 10) + '...',
      hashValid: hashedPassword.startsWith('$2')
    });

    // Create new user with explicit password validation
    logDebug('Creating new user document...');
    const userData = {
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword, // Ensure password is included
      fullName: trimmedFullName,
      profilePicture: '', // Default empty profile picture
      bio: '', // Default empty bio
      followers: [],
      following: [],
      posts: []
    };

    // Validate required fields before creating
    if (!userData.password) {
      logError('Password missing from user data object');
      return res.status(500).json({ message: 'User creation failed - password missing' });
    }

    const newUser = new User(userData);

    logDebug('Saving user to database...');
    const savedUser = await newUser.save();
    logDebug('User saved successfully', { 
      userId: savedUser._id,
      username: savedUser.username,
      email: savedUser.email.substring(0, 3) + '***',
      hasPassword: !!savedUser.password,
      passwordLength: savedUser.password ? savedUser.password.length : 0
    });

    // Generate token
    logDebug('Generating JWT token...');
    const token = generateToken(savedUser._id);
    logDebug('Token generated successfully', { 
      tokenPrefix: token.substring(0, 20) + '...',
      tokenLength: token.length
    });

    // Return user data (without password) and token
    const userResponse = {
      id: savedUser._id,
      username: savedUser.username,
      email: savedUser.email,
      fullName: savedUser.fullName,
      profilePicture: savedUser.profilePicture,
      bio: savedUser.bio,
      followers: savedUser.followers,
      following: savedUser.following,
      posts: savedUser.posts,
      createdAt: savedUser.createdAt
    };

    const executionTime = Date.now() - startTime;
    logDebug(`Registration completed successfully in ${executionTime}ms`, {
      userId: savedUser._id,
      username: savedUser.username
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      token
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    logError(`Registration failed after ${executionTime}ms`, error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      logError('MongoDB duplicate key error', { 
        duplicateField, 
        keyPattern: error.keyPattern,
        keyValue: error.keyValue 
      });
      return res.status(400).json({ 
        message: `This ${duplicateField} is already registered`,
        field: duplicateField
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      logError('MongoDB validation error', { errors, validationErrors: error.errors });
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors
      });
    }
    
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// POST /api/auth/register/check-availability - Check username/email availability
router.post('/register/check-availability', async (req, res) => {
  logDebug('Availability check started', { bodyKeys: Object.keys(req.body || {}) });

  try {
    const { username, email } = req.body;

    if (!username && !email) {
      logDebug('No username or email provided for availability check');
      return res.status(400).json({ 
        message: 'Please provide username or email to check' 
      });
    }

    const query = {};
    if (username) query.username = username.toLowerCase().trim();
    if (email) query.email = email.toLowerCase().trim();

    logDebug('Checking availability', { queryFields: Object.keys(query) });

    const existingUser = await User.findOne({
      $or: Object.entries(query).map(([key, value]) => ({ [key]: value }))
    });

    if (existingUser) {
      const unavailableField = existingUser.username === query.username ? 'username' : 'email';
      logDebug('Field not available', { 
        field: unavailableField,
        existingUserId: existingUser._id 
      });
      return res.json({
        available: false,
        field: unavailableField,
        message: `This ${unavailableField} is already taken`
      });
    }

    logDebug('Fields available');
    res.json({
      available: true,
      message: 'Available'
    });

  } catch (error) {
    logError('Availability check failed', error);
    res.status(500).json({ message: 'Server error during availability check' });
  }
});

// POST /api/auth/login - Enhanced Login Route with Comprehensive Debug
router.post('/login', async (req, res) => {
  const startTime = Date.now();
  logDebug('Login attempt started', { 
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    bodyKeys: Object.keys(req.body || {})
  });

  try {
    const { email, password } = req.body;

    // Log input validation
    logDebug('Login input validation', {
      hasEmail: !!email,
      hasPassword: !!password,
      emailType: typeof email,
      passwordType: typeof password,
      emailLength: email ? email.length : 0,
      passwordLength: password ? password.length : 0,
      emailValue: email ? `${email.substring(0, 3)}***` : 'none'
    });

    // Validation
    if (!email || !password) {
      logDebug('Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      logDebug('Invalid email or password type', {
        emailType: typeof email,
        passwordType: typeof password
      });
      return res.status(400).json({ message: 'Email and password must be strings' });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    logDebug('Email normalized', {
      original: email.substring(0, 3) + '***',
      normalized: normalizedEmail.substring(0, 3) + '***'
    });

    // Find user by email - EXPLICITLY SELECT PASSWORD
    logDebug('Searching for user in database...');
    const user = await User.findOne({ email: normalizedEmail }).select('+password'); // Force include password
    
    if (!user) {
      logDebug('User not found', { email: normalizedEmail.substring(0, 3) + '***' });
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    logDebug('User found in database', {
      userId: user._id,
      username: user.username,
      email: user.email.substring(0, 3) + '***',
      hasPassword: !!user.password,
      passwordType: typeof user.password,
      passwordLength: user.password ? user.password.length : 0,
      passwordPrefix: user.password ? user.password.substring(0, 10) + '...' : 'none',
      userCreatedAt: user.createdAt,
      userFields: Object.keys(user.toObject())
    });

    // CRITICAL: Check if password exists and is valid
    if (!user.password) {
      logError('User has no password in database', {
        userId: user._id,
        username: user.username,
        email: user.email.substring(0, 3) + '***'
      });
      return res.status(500).json({ 
        message: 'Account data corrupted. Please contact support.' 
      });
    }

    if (typeof user.password !== 'string') {
      logError('User password is not a string', {
        userId: user._id,
        passwordType: typeof user.password,
        passwordValue: user.password
      });
      return res.status(500).json({ 
        message: 'Account data corrupted. Please contact support.' 
      });
    }

    // Additional validation for bcrypt hash format
    if (user.password.length < 20) {
      logError('Password hash appears invalid - too short', {
        userId: user._id,
        passwordLength: user.password.length,
        passwordValue: user.password
      });
      return res.status(500).json({ 
        message: 'Account data corrupted. Please contact support.' 
      });
    }

    // Check if password starts with bcrypt format
    if (!user.password.startsWith('$2')) {
      logError('Password hash appears invalid - wrong format', {
        userId: user._id,
        passwordPrefix: user.password.substring(0, 10),
        passwordLength: user.password.length
      });
      return res.status(500).json({ 
        message: 'Account data corrupted. Please contact support.' 
      });
    }

    logDebug('Password validation passed, comparing with bcrypt...');
    
    // Enhanced bcrypt comparison with additional safety checks
    let isPasswordValid;
    try {
      logDebug('Calling bcrypt.compare', {
        providedPasswordLength: password.length,
        storedPasswordLength: user.password.length,
        storedPasswordPrefix: user.password.substring(0, 10) + '...'
      });

      isPasswordValid = await bcrypt.compare(password, user.password);
      
      logDebug('bcrypt.compare completed', { 
        isValid: isPasswordValid,
        comparisonCompleted: true 
      });
    } catch (bcryptError) {
      logError('bcrypt.compare failed', {
        error: bcryptError.message,
        providedPassword: {
          type: typeof password,
          length: password ? password.length : 0,
          value: password ? `${password.substring(0, 2)}***` : 'none'
        },
        storedPassword: {
          type: typeof user.password,
          length: user.password ? user.password.length : 0,
          value: user.password ? `${user.password.substring(0, 10)}...` : 'none'
        },
        userId: user._id,
        stack: bcryptError.stack
      });
      
      return res.status(500).json({ 
        message: 'Authentication system error. Please try again.' 
      });
    }

    if (!isPasswordValid) {
      logDebug('Password comparison failed - invalid password', {
        userId: user._id,
        username: user.username
      });
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    logDebug('Password comparison successful');

    // Generate token
    logDebug('Generating JWT token for successful login...');
    const token = generateToken(user._id);
    logDebug('Token generated successfully', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 20) + '...'
    });

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

    const executionTime = Date.now() - startTime;
    logDebug(`Login completed successfully in ${executionTime}ms`, {
      userId: user._id,
      username: user.username
    });

    res.json({
      message: 'Login successful',
      user: userResponse,
      token
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    logError(`Login failed after ${executionTime}ms`, error);
    
    // Provide different error messages based on error type
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      logError('Database error during login', error);
      res.status(500).json({ message: 'Database connection error. Please try again.' });
    } else if (error.message.includes('bcrypt')) {
      logError('bcrypt error during login', error);
      res.status(500).json({ message: 'Authentication system error. Please try again.' });
    } else {
      logError('Unknown error during login', error);
      res.status(500).json({ message: 'Server error during login' });
    }
  }
});

// GET /api/auth/me - Get current user (protected route) with enhanced debug
router.get('/me', authenticateToken, async (req, res) => {
  logDebug('Get current user profile request', {
    userId: req.user ? req.user._id : 'none',
    hasUser: !!req.user
  });

  try {
    if (!req.user) {
      logDebug('No user found in request object');
      return res.status(401).json({ message: 'User not authenticated' });
    }

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

    logDebug('User profile retrieved successfully', {
      userId: req.user._id,
      username: req.user.username
    });

    res.json({ user: userResponse });
  } catch (error) {
    logError('Get user profile failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Debug endpoint to check database user data
router.get('/debug/user/:email', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }

  try {
    const { email } = req.params;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      return res.json({ found: false, email });
    }

    res.json({
      found: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        hasPassword: !!user.password,
        passwordType: typeof user.password,
        passwordLength: user.password ? user.password.length : 0,
        passwordPrefix: user.password ? user.password.substring(0, 10) + '...' : 'none',
        createdAt: user.createdAt,
        fields: Object.keys(user.toObject())
      }
    });
  } catch (error) {
    logError('Debug endpoint failed', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
