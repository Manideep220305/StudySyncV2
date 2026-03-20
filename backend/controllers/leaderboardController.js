const mongoose = require('mongoose');
const User = require('../models/User');
const PointEvent = require('../models/PointEvent');
const Membership = require('../models/Membership');

/**
 * GET /api/leaderboard/global
 * Returns highest totalPoints users across the platform.
 * We use User.totalPoints for speed (pre-aggregated score).
 */
const getGlobalLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const rows = await User.find({})
      .select('username avatar totalPoints')
      .sort({ totalPoints: -1, username: 1 })
      .limit(limit)
      .lean();

    const leaderboard = rows.map((row, index) => ({
      rank: index + 1,
      userId: row._id,
      username: row.username,
      avatar: row.avatar,
      totalPoints: row.totalPoints || 0,
    }));

    return res.status(200).json(leaderboard);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/leaderboard/group/:groupId
 * Returns points ranking scoped to one group.
 * Uses PointEvent aggregation so only group-scoped events count.
 */
const getGroupLeaderboard = async (req, res) => {
  try {
    const { groupId } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid groupId' });
    }

    // Privacy + security: only group members can read the group leaderboard.
    const membership = await Membership.findOne({
      userId: req.user._id,
      groupId,
    });
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const rows = await PointEvent.aggregate([
      { $match: { groupId: new mongoose.Types.ObjectId(groupId) } },
      { $group: { _id: '$userId', totalPoints: { $sum: '$points' } } },
      { $sort: { totalPoints: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$user._id',
          username: '$user.username',
          avatar: '$user.avatar',
          totalPoints: 1,
        },
      },
    ]);

    const leaderboard = rows.map((row, index) => ({
      rank: index + 1,
      ...row,
    }));

    return res.status(200).json(leaderboard);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getGlobalLeaderboard,
  getGroupLeaderboard,
};

