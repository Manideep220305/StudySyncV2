const express = require('express');
const router = express.Router();
const {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} = require('../controllers/taskController'); // Ensure you made this file from the previous step

const { protect } = require('../middleware/authMiddleware');

// All these routes are protected
router.route('/').get(protect, getTasks).post(protect, createTask);
router.route('/:id').put(protect, updateTask).delete(protect, deleteTask);

module.exports = router;