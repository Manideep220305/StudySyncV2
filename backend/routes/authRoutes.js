const express = require('express');
const router = express.Router();

// Import the controller functions we just wrote
const { 
    registerUser, 
    loginUser, 
    logoutUser,
    getMe
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authRateLimiter } = require('../middleware/rateLimiters');
const {
  validate,
  authRegisterRules,
  authLoginRules,
} = require('../middleware/validationMiddleware');

// Define the routes
// The full path will be: http://localhost:5000/api/auth/register
router.post('/register', authRateLimiter, authRegisterRules, validate, registerUser);

// The full path will be: http://localhost:5000/api/auth/login
router.post('/login', authRateLimiter, authLoginRules, validate, loginUser);

// The full path will be: http://localhost:5000/api/auth/logout
router.post('/logout', authRateLimiter, logoutUser);

// The full path will be: http://localhost:5000/api/auth/me
router.get('/me', protect, getMe);

module.exports = router;
