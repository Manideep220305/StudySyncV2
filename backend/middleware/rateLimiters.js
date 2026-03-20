const rateLimit = require('express-rate-limit');

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMITED',
      message: 'Too many auth attempts. Please try again later.',
    },
  },
});

const pointsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'POINTS_RATE_LIMITED',
      message: 'Too many point events in a short window. Please slow down.',
    },
  },
});

module.exports = {
  authRateLimiter,
  pointsRateLimiter,
};
