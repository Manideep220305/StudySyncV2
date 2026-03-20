const Task = require('../models/Task');
const { awardPoints } = require('../services/pointsService');

// @desc    Get all tasks for the logged-in user
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res) => {
  try {
    // req.user.id comes from the auth middleware (we'll set that up next)
    const tasks = await Task.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private
const createTask = async (req, res) => {
  const { title, category, xpValue } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Please add a text field' });
  }

  try {
    const task = await Task.create({
      userId: req.user.id,
      title,
      category,
      xpValue
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update task (Mark as completed)
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if the user owns this task
    if (task.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    // We only award XP on the FIRST transition: incomplete -> complete.
    // This prevents duplicate XP if the same completed task is edited later.
    const wasCompleted = task.isCompleted;
    const willBeCompleted =
      typeof req.body.isCompleted === 'boolean' ? req.body.isCompleted : task.isCompleted;

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      req.body, // This will contain { isCompleted: true }
      { new: true }
    );

    if (!wasCompleted && willBeCompleted) {
      try {
        await awardPoints({
          userId: req.user.id,
          reason: 'task_resolved',
          points: updatedTask.xpValue || 10,
        });
      } catch (pointsError) {
        // Task update should still succeed even if XP write fails.
        // We log this so we can debug consistency issues later.
        console.error('Failed to award task points:', pointsError.message);
      }
    }

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = async (req, res) => {
    try {
      const task = await Task.findById(req.params.id);
  
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
  
      // Check user
      if (task.userId.toString() !== req.user.id) {
        return res.status(401).json({ message: 'User not authorized' });
      }
  
      await task.deleteOne();
  
      res.json({ id: req.params.id });
    } catch (error) {
        console.log(error)
      res.status(500).json({ message: 'Server Error' });
    }
  };

module.exports = {
  getTasks,
  createTask,
  updateTask,
  deleteTask
};
