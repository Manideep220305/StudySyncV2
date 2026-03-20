const mongoose = require('mongoose');
const Membership = require('../models/Membership');
const QuizAttempt = require('../models/QuizAttempt');
const { awardPoints } = require('../services/pointsService');

/**
 * POST /api/points/pomodoro
 * Logs pomodoro completion XP for current user.
 *
 * Body:
 * - points?: number (default 25)
 * - groupId?: string (optional; useful if session belongs to a study group)
 */
const logPomodoroCompletion = async (req, res) => {
  try {
    const requestedPoints = Number(req.body.points ?? 25);
    const safePoints = Math.min(Math.max(requestedPoints, 1), 120);
    const { groupId } = req.body;

    if (groupId && !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid groupId' });
    }

    // If groupId is provided, ensure user is actually in that group.
    if (groupId) {
      const membership = await Membership.findOne({
        userId: req.user._id,
        groupId,
      });
      if (!membership) {
        return res.status(403).json({ message: 'Not a member of this group' });
      }
    }

    const event = await awardPoints({
      userId: req.user._id,
      reason: 'pomodoro',
      points: safePoints,
      groupId: groupId || null,
    });

    return res.status(201).json({
      message: 'Pomodoro points recorded',
      event,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/points/quiz-correct
 * Preps us for quiz scoring flow.
 * This can be called after backend verifies a correct answer.
 */
const logQuizCorrect = async (req, res) => {
  try {
    const { groupId } = req.body;
    const requestedPoints = Number(req.body.points ?? 50);
    const safePoints = Math.min(Math.max(requestedPoints, 1), 200);

    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Valid groupId is required' });
    }

    const membership = await Membership.findOne({
      userId: req.user._id,
      groupId,
    });
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const event = await awardPoints({
      userId: req.user._id,
      reason: 'quiz_win',
      points: safePoints,
      groupId,
    });

    return res.status(201).json({
      message: 'Quiz points recorded',
      event,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/points/quiz-attempt
 * Logs raw quiz attempt analytics (topic + correctness) and optionally awards XP.
 *
 * Body:
 * - topic: string (required)
 * - isCorrect: boolean (required)
 * - difficulty?: 'easy' | 'medium' | 'hard'
 * - groupId?: string (optional, validates membership when provided)
 * - points?: number (optional, only used when isCorrect=true)
 */
const logQuizAttempt = async (req, res) => {
  try {
    const { topic, isCorrect, difficulty, groupId } = req.body;

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ message: 'topic is required' });
    }

    if (typeof isCorrect !== 'boolean') {
      return res.status(400).json({ message: 'isCorrect must be a boolean' });
    }

    if (groupId && !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid groupId' });
    }

    if (groupId) {
      const membership = await Membership.findOne({
        userId: req.user._id,
        groupId,
      });

      if (!membership) {
        return res.status(403).json({ message: 'Not a member of this group' });
      }
    }

    const attempt = await QuizAttempt.create({
      userId: req.user._id,
      groupId: groupId || null,
      topic: topic.trim(),
      isCorrect,
      difficulty: difficulty || 'medium',
    });

    let pointEvent = null;
    if (isCorrect) {
      const requestedPoints = Number(req.body.points ?? 50);
      const safePoints = Math.min(Math.max(requestedPoints, 1), 200);

      pointEvent = await awardPoints({
        userId: req.user._id,
        reason: 'quiz_win',
        points: safePoints,
        groupId: groupId || null,
      });
    }

    return res.status(201).json({
      message: 'Quiz attempt recorded',
      attempt,
      pointEvent,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  logPomodoroCompletion,
  logQuizCorrect,
  logQuizAttempt,
};

