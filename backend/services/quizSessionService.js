const crypto = require('crypto');

/**
 * In-memory Quiz Store (v1)
 *
 * Why in-memory first:
 * - Fast to build and easy to reason about.
 * - Great for proving end-to-end flow (start -> answer -> points -> leaderboard).
 * - Can be replaced with Redis/DB later without changing API contracts much.
 */
const activeQuizByGroup = new Map();

/**
 * Small starter question bank.
 * We intentionally keep this local so quiz feature can ship before RAG/PDF integration.
 */
const QUESTION_BANK = [
  {
    id: 'q-js-1',
    topic: 'javascript',
    question: 'Which array method creates a new array by transforming each item?',
    options: ['filter()', 'map()', 'reduce()', 'find()'],
    correctIndex: 1,
  },
  {
    id: 'q-js-2',
    topic: 'javascript',
    question: 'What does "===" compare in JavaScript?',
    options: ['Only value', 'Only type', 'Value and type', 'Object references only'],
    correctIndex: 2,
  },
  {
    id: 'q-mern-1',
    topic: 'mern',
    question: 'Which layer is responsible for schema validation in this stack?',
    options: ['React', 'Express', 'Mongoose', 'Socket.io'],
    correctIndex: 2,
  },
  {
    id: 'q-mern-2',
    topic: 'mern',
    question: 'Where should JWT verification happen for protected APIs?',
    options: ['Frontend route only', 'Backend middleware', 'MongoDB trigger', 'Tailwind config'],
    correctIndex: 1,
  },
  {
    id: 'q-db-1',
    topic: 'database',
    question: 'Why use a Membership junction collection instead of embedding all members in Group?',
    options: [
      'To reduce server memory only',
      'To support scaling/query flexibility and avoid large documents',
      'Because MongoDB does not support arrays',
      'To avoid indexes',
    ],
    correctIndex: 1,
  },
  {
    id: 'q-db-2',
    topic: 'database',
    question: 'What does a compound unique index on (userId, groupId) enforce?',
    options: [
      'One group per user globally',
      'A user can join the same group only once',
      'One leader per group',
      'One message per user',
    ],
    correctIndex: 1,
  },
];

const toPublicQuestion = (question) => ({
  id: question.id,
  question: question.question,
  options: question.options,
});

const toPublicSession = (session) => ({
  quizId: session.quizId,
  groupId: session.groupId,
  joinCode: session.joinCode,
  startedAt: session.startedAt,
  topic: session.topic,
  questions: session.questions.map(toPublicQuestion),
  answeredCount: session.questions.filter((q) => q.firstCorrectUserId).length,
  totalQuestions: session.questions.length,
  finished: session.finished,
});

const pickQuestions = (topic, count) => {
  const normalizedTopic = String(topic || 'general').toLowerCase();

  const topicPool =
    normalizedTopic === 'general'
      ? QUESTION_BANK
      : QUESTION_BANK.filter((q) => q.topic === normalizedTopic);

  // Fallback to all questions if requested topic is too narrow/empty.
  const pool = topicPool.length > 0 ? topicPool : QUESTION_BANK;
  const safeCount = Math.min(Math.max(Number(count) || 5, 1), pool.length);

  // Shuffle copy then slice.
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, safeCount).map((question) => ({
    ...question,
    firstCorrectUserId: null,
  }));
};

const startQuiz = ({ groupId, joinCode, startedBy, topic = 'general', count = 5 }) => {
  const questions = pickQuestions(topic, count);
  const session = buildSession({
    groupId,
    joinCode,
    startedBy,
    topic,
    questions,
  });

  activeQuizByGroup.set(String(groupId), session);
  return toPublicSession(session);
};

const buildSession = ({ groupId, joinCode, startedBy, topic, questions }) => {
  return {
    quizId: crypto.randomUUID(),
    groupId: String(groupId),
    joinCode,
    startedBy: String(startedBy),
    startedAt: new Date().toISOString(),
    topic,
    questions,
    finished: false,
    answersByUser: new Map(), // userId -> Set(questionId)
  };
};

const startQuizWithQuestions = ({
  groupId,
  joinCode,
  startedBy,
  topic = 'ai_rag',
  questions = [],
}) => {
  const normalizedQuestions = questions
    .map((question, index) => ({
      id: String(question?.id || `ai-q-${index + 1}-${crypto.randomUUID().slice(0, 8)}`),
      topic,
      question: String(question?.question || '').trim(),
      options: Array.isArray(question?.options)
        ? question.options.map((option) => String(option || '').trim())
        : [],
      correctIndex: Number(question?.correctIndex),
      explanation: String(question?.explanation || '').trim(),
      firstCorrectUserId: null,
    }))
    .filter(
      (question) =>
        question.question &&
        question.options.length === 4 &&
        question.options.every((option) => option.length > 0) &&
        Number.isInteger(question.correctIndex) &&
        question.correctIndex >= 0 &&
        question.correctIndex <= 3
    );

  if (!normalizedQuestions.length) {
    return null;
  }

  const session = buildSession({
    groupId,
    joinCode,
    startedBy,
    topic,
    questions: normalizedQuestions,
  });

  activeQuizByGroup.set(String(groupId), session);
  return toPublicSession(session);
};

const getActiveQuiz = (groupId) => {
  const session = activeQuizByGroup.get(String(groupId));
  if (!session) return null;
  return toPublicSession(session);
};

const endQuiz = (groupId) => {
  const key = String(groupId);
  const session = activeQuizByGroup.get(key);
  if (!session) return null;

  session.finished = true;
  const scoreboard = getQuizScoreboard(key);
  activeQuizByGroup.delete(key);

  return {
    quizId: session.quizId,
    groupId: session.groupId,
    totalQuestions: session.questions.length,
    scoreboard,
  };
};

/**
 * Builds score table from "first correct" winners.
 * Score rule (v1): each first-correct answer = 1 point.
 */
const getQuizScoreboard = (groupId) => {
  const session = activeQuizByGroup.get(String(groupId));
  if (!session) return null;

  const scoreByUserId = new Map();
  // Include all participants who attempted at least one answer, even if score is 0.
  for (const userId of session.answersByUser.keys()) {
    scoreByUserId.set(userId, 0);
  }

  session.questions.forEach((question) => {
    if (!question.firstCorrectUserId) return;
    const current = scoreByUserId.get(question.firstCorrectUserId) || 0;
    scoreByUserId.set(question.firstCorrectUserId, current + 1);
  });

  const ranking = [...scoreByUserId.entries()]
    .map(([userId, score]) => ({ userId, score }))
    .sort((a, b) => b.score - a.score);

  return {
    quizId: session.quizId,
    groupId: session.groupId,
    totalQuestions: session.questions.length,
    finished: session.finished,
    ranking,
  };
};

const answerQuestion = ({ groupId, userId, questionId, answerIndex }) => {
  const session = activeQuizByGroup.get(String(groupId));
  if (!session) {
    return { ok: false, status: 404, message: 'No active quiz for this group' };
  }

  if (session.finished) {
    return { ok: false, status: 400, message: 'Quiz is already finished' };
  }

  const question = session.questions.find((item) => item.id === questionId);
  if (!question) {
    return { ok: false, status: 404, message: 'Question not found in active quiz' };
  }

  const numericAnswerIndex = Number(answerIndex);
  if (!Number.isInteger(numericAnswerIndex) || numericAnswerIndex < 0 || numericAnswerIndex >= question.options.length) {
    return { ok: false, status: 400, message: 'Invalid answer index' };
  }

  const normalizedUserId = String(userId);
  if (!session.answersByUser.has(normalizedUserId)) {
    session.answersByUser.set(normalizedUserId, new Set());
  }

  const userAnsweredSet = session.answersByUser.get(normalizedUserId);
  if (userAnsweredSet.has(questionId)) {
    return { ok: false, status: 409, message: 'You already answered this question' };
  }

  userAnsweredSet.add(questionId);

  const isCorrect = numericAnswerIndex === question.correctIndex;
  const isFirstCorrect = isCorrect && !question.firstCorrectUserId;
  if (isFirstCorrect) {
    question.firstCorrectUserId = normalizedUserId;
  }

  const answeredCount = session.questions.filter((item) => item.firstCorrectUserId).length;
  if (answeredCount === session.questions.length) {
    session.finished = true;
  }

  return {
    ok: true,
    result: {
      quizId: session.quizId,
      questionId,
      isCorrect,
      isFirstCorrect,
      correctIndex: question.correctIndex,
      answeredCount,
      totalQuestions: session.questions.length,
      finished: session.finished,
    },
  };
};

module.exports = {
  startQuiz,
  startQuizWithQuestions,
  getActiveQuiz,
  endQuiz,
  getQuizScoreboard,
  answerQuestion,
};
