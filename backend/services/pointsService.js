const PointEvent = require('../models/PointEvent');
const User = require('../models/User');

/**
 * Centralized XP writer.
 *
 * Why this exists:
 * - We want ONE place that updates both:
 *   1) PointEvent history (audit trail),
 *   2) User.totalPoints (fast leaderboard reads).
 * - This avoids duplicated logic across task, timer, and quiz flows.
 */
const awardPoints = async ({ userId, reason, points, groupId = null }) => {
  const numericPoints = Number(points);
  if (!Number.isFinite(numericPoints) || numericPoints <= 0) {
    throw new Error('Points must be a positive number');
  }

  const event = await PointEvent.create({
    userId,
    groupId: groupId || undefined,
    points: numericPoints,
    reason,
  });

  await User.findByIdAndUpdate(userId, { $inc: { totalPoints: numericPoints } });

  return event;
};

module.exports = { awardPoints };

