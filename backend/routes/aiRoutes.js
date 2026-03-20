const express = require('express');
const multer = require('multer');
const { protect, requireRole } = require('../middleware/authMiddleware');
const {
  uploadPdfToAi,
  generateQuizFromAi,
  askAi,
  aiHealth,
} = require('../controllers/aiController');
const {
  validate,
  aiUploadRules,
  aiGenerateQuizRules,
  aiAskRules,
} = require('../middleware/validationMiddleware');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/health', protect, aiHealth);

router.post(
  '/upload-pdf',
  protect,
  upload.single('file'),
  aiUploadRules,
  validate,
  requireRole('leader'),
  uploadPdfToAi
);

router.post(
  '/generate-quiz',
  protect,
  aiGenerateQuizRules,
  validate,
  requireRole('leader'),
  generateQuizFromAi
);

router.post('/ask', protect, aiAskRules, validate, askAi);

module.exports = router;
