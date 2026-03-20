const express = require('express');
const router = express.Router();
const {
    createGroup,
    getGroups,
    getUserGroups,
    getGroupById,
    joinGroup,
    deleteGroup,
    resetJoinCode,
    addGroupFiles,
    getGroupFiles,
} = require('../controllers/groupController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const {
  validate,
  createGroupRules,
  joinGroupRules,
  groupIdParamRules,
  groupFileNamesRules,
} = require('../middleware/validationMiddleware');

// Public/All Member Routes
router.post('/', protect, createGroupRules, validate, createGroup);
router.get('/', protect, getUserGroups);
router.get('/public', getGroups);
router.post('/join', protect, joinGroupRules, validate, joinGroup);
router.get('/:groupId/files', protect, groupIdParamRules, validate, getGroupFiles);
router.post('/:groupId/files', protect, groupFileNamesRules, validate, addGroupFiles);
router.get('/:groupId', protect, groupIdParamRules, validate, getGroupById);

// Leader Only Routes
router.delete('/:groupId', protect, groupIdParamRules, validate, requireRole('leader'), deleteGroup);
router.put('/:groupId/code', protect, groupIdParamRules, validate, requireRole('leader'), resetJoinCode);

module.exports = router;
