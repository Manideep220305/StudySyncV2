const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { pointsRateLimiter } = require('../middleware/rateLimiters');
const {
  logPomodoroCompletion,
  logQuizCorrect,
  logQuizAttempt,
} = require('../controllers/pointsController');
const {
  validate,
  pointsPomodoroRules,
  pointsQuizCorrectRules,
  pointsQuizAttemptRules,
} = require('../middleware/validationMiddleware');

// Timed focus completion -> awards pomodoro points
router.post('/pomodoro', protect, pointsRateLimiter, pointsPomodoroRules, validate, logPomodoroCompletion);

// Quiz answer correctness -> awards quiz points
router.post('/quiz-correct', protect, pointsRateLimiter, pointsQuizCorrectRules, validate, logQuizCorrect);

// Raw quiz attempt analytics (topic accuracy source for dashboard radar)
router.post('/quiz-attempt', protect, pointsRateLimiter, pointsQuizAttemptRules, validate, logQuizAttempt);

module.exports = router;
