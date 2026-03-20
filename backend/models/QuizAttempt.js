const mongoose = require('mongoose');

// QuizAttempt stores per-question outcomes so analytics can compute
// true topic accuracy trends (instead of using task completion as a proxy).
const quizAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
  },
  { timestamps: true }
);

// Indexes for profile analytics queries.
quizAttemptSchema.index({ userId: 1, createdAt: -1 });
quizAttemptSchema.index({ userId: 1, topic: 1, createdAt: -1 });
quizAttemptSchema.index({ groupId: 1, createdAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
