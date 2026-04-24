const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { createHttpError } = require('../middleware/errorMiddleware');
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

const uploadSinglePdf = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(createHttpError(400, 'FILE_TOO_LARGE', 'PDF exceeds 10MB limit'));
    }

    return next(error);
  });
};

router.get('/health', protect, aiHealth);

router.post(
  '/upload-pdf',
  protect,
  uploadSinglePdf,
  aiUploadRules,
  validate,
  uploadPdfToAi
);

router.post(
  '/generate-quiz',
  protect,
  aiGenerateQuizRules,
  validate,
  generateQuizFromAi
);

router.post('/ask', protect, aiAskRules, validate, askAi);

module.exports = router;
