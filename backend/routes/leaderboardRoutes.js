const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getGlobalLeaderboard,
  getGroupLeaderboard,
} = require('../controllers/leaderboardController');

router.get('/global', protect, getGlobalLeaderboard);
router.get('/group/:groupId', protect, getGroupLeaderboard);

module.exports = router;

