const mongoose = require('mongoose');
const Group = require('../models/Group');
const Membership = require('../models/Membership');
const User = require('../models/User');
const { awardPoints } = require('../services/pointsService');
const {
  startQuiz,
  getActiveQuiz,
  endQuiz,
  getQuizScoreboard,
  answerQuestion,
} = require('../services/quizSessionService');
const { getStudyNamespace } = require('../socket');

const buildQuizSummary = async (scoreboard) => {
  if (!scoreboard) return null;

  const userIds = scoreboard.ranking.map((row) => row.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select('username avatar')
    .lean();

  const userMap = new Map(users.map((user) => [String(user._id), user]));

  const ranking = scoreboard.ranking.map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    username: userMap.get(String(row.userId))?.username || 'Unknown',
    avatar: userMap.get(String(row.userId))?.avatar,
    score: row.score,
  }));

  return {
    quizId: scoreboard.quizId,
    groupId: scoreboard.groupId,
    totalQuestions: scoreboard.totalQuestions,
    winner: ranking[0] || null,
    topPlayers: ranking.slice(0, 3),
    ranking,
  };
};

/**
 * POST /api/groups/:groupId/quiz/start
 * Leader starts a quiz for their group.
 */
const startGroupQuiz = async (req, res) => {
  try {
    const { groupId } = req.params;
    const topic = req.body.topic || 'general';
    const count = Number(req.body.count || 5);

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid groupId' });
    }

    const group = await Group.findById(groupId).lean();
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const session = startQuiz({
      groupId,
      joinCode: group.joinCode,
      startedBy: req.user._id,
      topic,
      count,
    });

    // Realtime broadcast so all connected members see quiz start instantly.
    const studyNamespace = getStudyNamespace();
    if (studyNamespace) {
      studyNamespace.to(group.joinCode).emit('quiz-started', session);
    }

    return res.status(201).json(session);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/groups/:groupId/quiz/current
 * Any member can fetch currently active quiz snapshot.
 */
const getCurrentGroupQuiz = async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid groupId' });
    }

    const membership = await Membership.findOne({
      userId: req.user._id,
      groupId,
    });
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const session = getActiveQuiz(groupId);
    if (!session) {
      return res.status(404).json({ message: 'No active quiz for this group' });
    }

    return res.status(200).json(session);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/groups/:groupId/quiz/answer
 * Members submit an answer to one question.
 * If first correct, we award quiz points and emit leaderboard refresh event.
 */
const answerGroupQuiz = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { questionId, answerIndex } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid groupId' });
    }

    const membership = await Membership.findOne({
      userId: req.user._id,
      groupId,
    });
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const answer = answerQuestion({
      groupId,
      userId: req.user._id,
      questionId,
      answerIndex,
    });

    if (!answer.ok) {
      return res.status(answer.status).json({ message: answer.message });
    }

    const result = answer.result;

    // Reward only first correct answer per question.
    if (result.isFirstCorrect) {
      await awardPoints({
        userId: req.user._id,
        groupId,
        reason: 'quiz_win',
        points: 50,
      });
    }

    const group = await Group.findById(groupId).select('joinCode').lean();
    const studyNamespace = getStudyNamespace();
    if (group?.joinCode && studyNamespace) {
      studyNamespace.to(group.joinCode).emit('quiz-answer-result', {
        userId: req.user._id,
        username: req.user.username,
        ...result,
      });

      if (result.isFirstCorrect) {
        studyNamespace.to(group.joinCode).emit('leaderboard-updated', {
          groupId,
          reason: 'quiz_win',
          awardedTo: req.user._id,
          points: 50,
        });
      }

      if (result.finished) {
        const scoreboard = getQuizScoreboard(groupId);
        const summary = await buildQuizSummary(scoreboard);

        studyNamespace.to(group.joinCode).emit('quiz-finished', {
          groupId,
          quizId: result.quizId,
          summary,
        });
      }
    }

    const responsePayload = { ...result };
    if (result.finished) {
      const scoreboard = getQuizScoreboard(groupId);
      responsePayload.summary = await buildQuizSummary(scoreboard);
    }
    return res.status(200).json(responsePayload);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/groups/:groupId/quiz/end
 * Leader can force-end and clear a stuck quiz.
 */
const endGroupQuiz = async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid groupId' });
    }

    const group = await Group.findById(groupId).select('joinCode').lean();
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const ended = endQuiz(groupId);
    if (!ended) {
      return res.status(404).json({ message: 'No active quiz for this group' });
    }

    const summary = await buildQuizSummary(ended.scoreboard);
    const studyNamespace = getStudyNamespace();
    if (studyNamespace) {
      studyNamespace.to(group.joinCode).emit('quiz-finished', {
        groupId,
        quizId: ended.quizId,
        summary,
      });
    }

    return res.status(200).json({
      message: 'Quiz ended',
      summary,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  startGroupQuiz,
  getCurrentGroupQuiz,
  answerGroupQuiz,
  endGroupQuiz,
};
