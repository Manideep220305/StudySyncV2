const { body, param, validationResult } = require('express-validator');
const { createHttpError } = require('./errorMiddleware');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  return next(
    createHttpError(400, 'VALIDATION_FAILED', 'Validation failed', {
      fields: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    })
  );
};

const authRegisterRules = [
  body('username').isString().trim().isLength({ min: 3, max: 40 }).withMessage('username must be 3-40 chars'),
  body('email').isEmail().normalizeEmail().withMessage('valid email is required'),
  body('password').isString().isLength({ min: 6, max: 128 }).withMessage('password must be 6-128 chars'),
];

const authLoginRules = [
  body('email').isEmail().normalizeEmail().withMessage('valid email is required'),
  body('password').isString().isLength({ min: 6, max: 128 }).withMessage('password must be 6-128 chars'),
];

const createGroupRules = [
  body('name').isString().trim().isLength({ min: 2, max: 50 }).withMessage('name must be 2-50 chars'),
  body('description')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('description must be <= 200 chars'),
  body('tags').optional().isArray({ max: 10 }).withMessage('tags must be an array'),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be boolean'),
];

const joinGroupRules = [
  body('joinCode').isString().trim().isLength({ min: 4, max: 12 }).withMessage('joinCode must be 4-12 chars'),
];

const groupIdParamRules = [
  param('groupId').isMongoId().withMessage('groupId must be a valid id'),
];

const quizStartRules = [
  ...groupIdParamRules,
  body('topic')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 40 })
    .withMessage('topic must be 2-40 chars'),
  body('count').optional().isInt({ min: 1, max: 10 }).withMessage('count must be 1-10'),
];

const quizAnswerRules = [
  ...groupIdParamRules,
  body('questionId').isString().trim().isLength({ min: 2, max: 100 }).withMessage('questionId is required'),
  body('answerIndex').isInt({ min: 0, max: 10 }).withMessage('answerIndex must be a valid integer'),
];

const pointsPomodoroRules = [
  body('points').optional().isInt({ min: 1, max: 120 }).withMessage('points must be 1-120'),
  body('groupId').optional({ nullable: true }).isMongoId().withMessage('groupId must be a valid id'),
];

const pointsQuizCorrectRules = [
  body('groupId').isMongoId().withMessage('groupId must be a valid id'),
  body('points').optional().isInt({ min: 1, max: 200 }).withMessage('points must be 1-200'),
];

const pointsQuizAttemptRules = [
  body('topic').isString().trim().isLength({ min: 2, max: 100 }).withMessage('topic must be 2-100 chars'),
  body('isCorrect').isBoolean().withMessage('isCorrect must be boolean'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('difficulty must be easy|medium|hard'),
  body('groupId').optional({ nullable: true }).isMongoId().withMessage('groupId must be a valid id'),
  body('points').optional().isInt({ min: 1, max: 200 }).withMessage('points must be 1-200'),
];

const aiUploadRules = [
  body('groupId').isMongoId().withMessage('groupId must be a valid id'),
  body('replaceContext')
    .optional()
    .isIn(['true', 'false', true, false])
    .withMessage('replaceContext must be true or false'),
];

const aiGenerateQuizRules = [
  body('groupId').isMongoId().withMessage('groupId must be a valid id'),
  body('numQuestions')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('numQuestions must be 1-10'),
  body('num_questions')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('num_questions must be 1-10'),
];

const aiAskRules = [
  body('groupId').isMongoId().withMessage('groupId must be a valid id'),
  body('question')
    .isString()
    .trim()
    .isLength({ min: 2, max: 4000 })
    .withMessage('question must be 2-4000 chars'),
];

const groupFileNamesRules = [
  ...groupIdParamRules,
  body('fileNames').isArray({ min: 1, max: 20 }).withMessage('fileNames must be a non-empty array'),
  body('fileNames.*')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('each file name must be 1-255 chars'),
];

module.exports = {
  validate,
  authRegisterRules,
  authLoginRules,
  createGroupRules,
  joinGroupRules,
  groupIdParamRules,
  quizStartRules,
  quizAnswerRules,
  pointsPomodoroRules,
  pointsQuizCorrectRules,
  pointsQuizAttemptRules,
  aiUploadRules,
  aiGenerateQuizRules,
  aiAskRules,
  groupFileNamesRules,
};
