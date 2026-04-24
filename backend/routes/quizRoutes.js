const express = require('express');
const router = express.Router({ mergeParams: true });

const { protect } = require('../middleware/authMiddleware');
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

// Any group member can start quiz for the group
router.post('/start', protect, quizStartRules, validate, startGroupQuiz);

// Members can read the active quiz snapshot
router.get('/current', protect, groupIdParamRules, validate, getCurrentGroupQuiz);

// Members submit answers
router.post('/answer', protect, quizAnswerRules, validate, answerGroupQuiz);

// Any group member can force-end a quiz to clear stuck sessions
router.post('/end', protect, groupIdParamRules, validate, endGroupQuiz);

module.exports = router;
