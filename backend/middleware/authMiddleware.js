// authMiddleware.js — Authentication & Authorization Guards
// This file contains two middleware functions:
//   1. `protect`      — verifies the JWT and attaches the user to req.user
//   2. `requireRole`  — checks if req.user has a specific role in a group
//
// Middleware is a function that runs BETWEEN receiving a request and sending a response.
// If validation passes, we call next() to move to the actual controller.
// If it fails, we send an error response immediately and stop the chain.

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Membership = require('../models/Membership');

// --- protect middleware ---
// Protects any route that requires the user to be logged in.
// It reads the JWT from the httpOnly cookie (set during login/register),
// verifies its signature using JWT_SECRET, and attaches the User document to req.user.
//
// Usage in routes: router.get('/me', protect, authController.getMe)
const protect = async (req, res, next) => {
  let token;

  // Read the JWT from the cookie (NOT from headers/Authorization — we use httpOnly cookies for security)
  if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (token) {
    try {
      // jwt.verify decodes the token and checks the signature.
      // If the token is expired or tampered with, it throws an error.
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch the full user document from MongoDB using the ID stored in the token.
      // `.select('-password')` ensures the hashed password is never attached to req.user.
      req.user = await User.findById(decoded.id).select('-password');

      next(); // All good — proceed to the next middleware/controller
    } catch (error) {
      console.log(error);
      res.status(401).json({ message: 'Not authorized' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// --- requireRole middleware ---
// A "higher-order middleware" — it takes a role string and returns a middleware function.
// Used to protect leader-only actions (delete group, reset join code, kick members).
//
// It works by looking up the Membership record for req.user in the specified group.
// The groupId comes from either the route parameter or the request body.
//
// Usage in routes: router.delete('/:groupId', protect, requireRole('leader'), deleteGroup)
// Note: `protect` must run FIRST so req.user is populated before requireRole reads it.
const requireRole = (role) => async (req, res, next) => {
  try {
    // GroupId can come from URL param (e.g. DELETE /api/groups/:groupId) or from req.body
    const groupId = req.params.groupId || req.body.groupId;

    if (!groupId) {
      return res.status(400).json({ message: 'Group ID is required for role verification' });
    }

    // Look up this user's membership in the target group
    const membership = await Membership.findOne({ 
      userId: req.user._id, 
      groupId: groupId 
    });

    // If no membership found (user isn't in the group) or the role doesn't match, deny access
    if (!membership || membership.role !== role) {
      return res.status(403).json({ message: `Forbidden: require ${role} role` });
    }

    next(); // User has the required role — proceed to the controller
  } catch (error) {
    res.status(500).json({ message: 'Server Error during role verification' });
  }
};

module.exports = { protect, requireRole };