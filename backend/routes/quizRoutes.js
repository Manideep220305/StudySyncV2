const express = require('express');
const router = express.Router({ mergeParams: true });

const { protect, requireRole } = require('../middleware/authMiddleware');
const {
  startGroupQuiz,
  getCurrentGroupQuiz,
  answerGroupQuiz,
  endGroupQuiz,
} = require('../controllers/quizController');
const {
  validate,
  groupIdParamRules,
  quizStartRules,
  quizAnswerRules,
} = require('../middleware/validationMiddleware');

// Leader starts quiz for the group
router.post('/start', protect, quizStartRules, validate, requireRole('leader'), startGroupQuiz);

// Members can read the active quiz snapshot
router.get('/current', protect, groupIdParamRules, validate, getCurrentGroupQuiz);

// Members submit answers
router.post('/answer', protect, quizAnswerRules, validate, answerGroupQuiz);

// Leader can force-end a quiz to clear stuck sessions
router.post('/end', protect, groupIdParamRules, validate, requireRole('leader'), endGroupQuiz);

module.exports = router;
