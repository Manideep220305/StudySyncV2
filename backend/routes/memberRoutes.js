const express = require('express');
const router = express.Router({ mergeParams: true }); // Important to access groupId from parent route
const {
    getGroupMembers,
    kickMember,
    promoteToLeader
} = require('../controllers/memberController');
const { protect, requireRole } = require('../middleware/authMiddleware');

router.get('/', protect, getGroupMembers);
router.delete('/:userId', protect, requireRole('leader'), kickMember);
router.patch('/:userId', protect, requireRole('leader'), promoteToLeader);

module.exports = router;
