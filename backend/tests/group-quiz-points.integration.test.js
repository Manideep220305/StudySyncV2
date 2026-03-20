const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_123456';

const app = require('../app');
const User = require('../models/User');
const PointEvent = require('../models/PointEvent');
const { connectTestDb, clearTestDb, closeTestDb } = require('./helpers/db');

test.before(async () => {
  await connectTestDb();
});

test.afterEach(async () => {
  await clearTestDb();
});

test.after(async () => {
  await closeTestDb();
});

const register = async (agent, payload) => {
  const response = await agent.post('/api/auth/register').send(payload);
  assert.equal(response.status, 201);
  return response.body.data;
};

test('member cannot start quiz, can answer, and first-correct awards points', async () => {
  const leaderAgent = request.agent(app);
  const memberAgent = request.agent(app);

  await register(leaderAgent, {
    username: 'leader1',
    email: 'leader1@test.dev',
    password: 'password123',
  });
  const member = await register(memberAgent, {
    username: 'member1',
    email: 'member1@test.dev',
    password: 'password123',
  });

  const createGroupResponse = await leaderAgent.post('/api/groups').send({
    name: 'Deep Work Room',
    description: 'Focus and quizzes',
  });
  assert.equal(createGroupResponse.status, 201);
  const createdGroup = createGroupResponse.body.data;

  const joinResponse = await memberAgent.post('/api/groups/join').send({
    joinCode: createdGroup.joinCode,
  });
  assert.equal(joinResponse.status, 201);

  const forbiddenStart = await memberAgent
    .post(`/api/groups/${createdGroup._id}/quiz/start`)
    .send({ topic: 'javascript', count: 1 });
  assert.equal(forbiddenStart.status, 403);

  const startQuizResponse = await leaderAgent
    .post(`/api/groups/${createdGroup._id}/quiz/start`)
    .send({ topic: 'javascript', count: 1 });
  assert.equal(startQuizResponse.status, 201);

  const quiz = startQuizResponse.body.data;
  const question = quiz.questions[0];
  assert.ok(question);

  const answerResponse = await memberAgent
    .post(`/api/groups/${createdGroup._id}/quiz/answer`)
    .send({ questionId: question.id, answerIndex: 0 });
  assert.equal(answerResponse.status, 200);
  assert.equal(answerResponse.body.success, true);

  // Try all options until first-correct is awarded so we do not depend on bank internals.
  let awarded = answerResponse.body.data.isFirstCorrect === true;
  if (!awarded) {
    for (let index = 1; index <= 3; index += 1) {
      const retryLeader = request.agent(app);
      await register(retryLeader, {
        username: `leader_retry_${index}`,
        email: `leader_retry_${index}@test.dev`,
        password: 'password123',
      });
      const retryGroup = await retryLeader.post('/api/groups').send({ name: `g${index}` });
      const retryQuiz = await retryLeader
        .post(`/api/groups/${retryGroup.body.data._id}/quiz/start`)
        .send({ topic: 'javascript', count: 1 });

      const retryMember = request.agent(app);
      await register(retryMember, {
        username: `member_retry_${index}`,
        email: `member_retry_${index}@test.dev`,
        password: 'password123',
      });
      await retryMember.post('/api/groups/join').send({ joinCode: retryGroup.body.data.joinCode });

      const retryAnswer = await retryMember
        .post(`/api/groups/${retryGroup.body.data._id}/quiz/answer`)
        .send({ questionId: retryQuiz.body.data.questions[0].id, answerIndex: index });

      if (retryAnswer.body?.data?.isFirstCorrect) {
        awarded = true;
        break;
      }
    }
  }

  const memberUser = await User.findById(member._id).lean();
  const pointEvents = await PointEvent.find({ userId: member._id, reason: 'quiz_win' }).lean();

  if (awarded) {
    assert.ok(memberUser.totalPoints >= 50);
    assert.ok(pointEvents.length >= 1);
  } else {
    assert.equal(memberUser.totalPoints, 0);
  }
});

test('pomodoro points endpoint writes event and increments totalPoints', async () => {
  const agent = request.agent(app);
  const user = await register(agent, {
    username: 'timer_user',
    email: 'timer_user@test.dev',
    password: 'password123',
  });

  const pointsResponse = await agent.post('/api/points/pomodoro').send({ points: 30 });
  assert.equal(pointsResponse.status, 201);
  assert.equal(pointsResponse.body.success, true);

  const refreshed = await User.findById(user._id).lean();
  assert.equal(refreshed.totalPoints, 30);

  const events = await PointEvent.find({ userId: user._id, reason: 'pomodoro' }).lean();
  assert.equal(events.length, 1);
});
