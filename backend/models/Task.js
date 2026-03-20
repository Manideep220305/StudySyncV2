const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
//     userId: This links the task to YOU. Without this, everyone would see everyone else's tasks.

// xpValue: This is the secret sauce. Later, when you mark isCompleted: true, we will take this number and add it to your User Profile.
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // Every task MUST belong to a user
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  xpValue: {
    type: Number,
    default: 10 // Default 10 XP per task. We can change this later for "Hard" tasks.
  },
  category: {
    type: String,
    enum: ['DSA', 'Development', 'College', 'Other'],
    default: 'Other'
  }
}, { timestamps: true }); // Automatically adds createdAt and updatedAt

module.exports = mongoose.model('Task', taskSchema);
