const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getMyProfile, getMyAccuracy } = require('../controllers/profileController');

router.get('/me', protect, getMyProfile);
router.get('/accuracy', protect, getMyAccuracy);

module.exports = router;

