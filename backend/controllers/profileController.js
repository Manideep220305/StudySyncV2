const PointEvent = require('../models/PointEvent');
const Membership = require('../models/Membership');
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');

/**
 * GET /api/profile/me
 * Lightweight profile payload for the profile page:
 * - user basics
 * - global rank
 * - points by reason
 * - recent activity events
 */
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const [user, groupsCount, reasonBreakdownRaw, recentEvents] = await Promise.all([
      User.findById(userId).select('username email avatar bio totalPoints createdAt').lean(),
      Membership.countDocuments({ userId }),
      PointEvent.aggregate([
        { $match: { userId } },
        { $group: { _id: '$reason', totalPoints: { $sum: '$points' }, count: { $sum: 1 } } },
      ]),
      PointEvent.find({ userId })
        .sort({ createdAt: -1 })
        .limit(15)
        .select('points reason groupId createdAt')
        .lean(),
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const higherScores = await User.countDocuments({ totalPoints: { $gt: user.totalPoints || 0 } });
    const globalRank = higherScores + 1;

    const reasonBreakdown = {
      task_resolved: { points: 0, count: 0 },
      pomodoro: { points: 0, count: 0 },
      quiz_win: { points: 0, count: 0 },
    };

    reasonBreakdownRaw.forEach((row) => {
      if (reasonBreakdown[row._id]) {
        reasonBreakdown[row._id] = {
          points: row.totalPoints,
          count: row.count,
        };
      }
    });

    return res.status(200).json({
      user,
      globalRank,
      groupsCount,
      reasonBreakdown,
      recentEvents,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/profile/accuracy
 * Topic-wise quiz accuracy analytics used by Dashboard "Weak Topic Radar".
 *
 * Response shape per topic:
 * - currentAttempts/currentAccuracy : last 7 days
 * - previousAttempts/previousAccuracy: previous 7-day window
 * - delta: currentAccuracy - previousAccuracy
 */
const getMyAccuracy = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const rows = await QuizAttempt.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: previousStart },
        },
      },
      {
        $project: {
          topic: 1,
          isCorrect: 1,
          window: {
            $cond: [{ $gte: ['$createdAt', currentStart] }, 'current', 'previous'],
          },
        },
      },
      {
        $group: {
          _id: { topic: '$topic', window: '$window' },
          attempts: { $sum: 1 },
          correct: {
            $sum: { $cond: ['$isCorrect', 1, 0] },
          },
        },
      },
    ]);

    const topicMap = new Map();

    rows.forEach((row) => {
      const topic = row._id.topic || 'Other';
      const window = row._id.window;
      const base = topicMap.get(topic) || {
        topic,
        currentAttempts: 0,
        currentCorrect: 0,
        previousAttempts: 0,
        previousCorrect: 0,
      };

      if (window === 'current') {
        base.currentAttempts = row.attempts;
        base.currentCorrect = row.correct;
      } else {
        base.previousAttempts = row.attempts;
        base.previousCorrect = row.correct;
      }

      topicMap.set(topic, base);
    });

    const topics = Array.from(topicMap.values())
      .map((entry) => {
        const currentAccuracy = entry.currentAttempts
          ? Math.round((entry.currentCorrect / entry.currentAttempts) * 100)
          : 0;
        const previousAccuracy = entry.previousAttempts
          ? Math.round((entry.previousCorrect / entry.previousAttempts) * 100)
          : 0;

        return {
          topic: entry.topic,
          currentAttempts: entry.currentAttempts,
          currentCorrect: entry.currentCorrect,
          currentAccuracy,
          previousAttempts: entry.previousAttempts,
          previousCorrect: entry.previousCorrect,
          previousAccuracy,
          delta: currentAccuracy - previousAccuracy,
        };
      })
      .sort((a, b) => {
        if (a.currentAttempts === b.currentAttempts) {
          return a.delta - b.delta;
        }
        return b.currentAttempts - a.currentAttempts;
      });

    return res.status(200).json({
      windowDays: 7,
      generatedAt: now,
      topics,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMyProfile,
  getMyAccuracy,
};

