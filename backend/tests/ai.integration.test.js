const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_123456';

const app = require('../app');
const { connectTestDb, clearTestDb, closeTestDb } = require('./helpers/db');
const { resetAiServiceStatus } = require('../services/aiHealthService');

const originalFetch = global.fetch;

const register = async (agent, payload) => {
  const response = await agent.post('/api/auth/register').send(payload);
  assert.equal(response.status, 201);
  return response.body.data;
};

const createGroup = async (agent, name = 'AI Room') => {
  const response = await agent.post('/api/groups').send({ name });
  assert.equal(response.status, 201);
  return response.body.data;
};

test.before(async () => {
  await connectTestDb();
});

test.afterEach(async () => {
  global.fetch = originalFetch;
  resetAiServiceStatus();
  await clearTestDb();
});

test.after(async () => {
  global.fetch = originalFetch;
  await closeTestDb();
});

test('GET /api/ai/health returns offline status payload when upstream AI is unavailable', async () => {
  const agent = request.agent(app);
  await register(agent, {
    username: 'ai_health_user',
    email: 'ai_health_user@test.dev',
    password: 'password123',
  });

  global.fetch = async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:8000');
  };

  const response = await agent.get('/api/ai/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.available, false);
  assert.equal(response.body.data.status, 'offline');
  assert.match(response.body.data.message, /ECONNREFUSED|unavailable|unreachable/i);
});

test('POST /api/ai/ask rejects non-members before contacting upstream AI', async () => {
  const leaderAgent = request.agent(app);
  const outsiderAgent = request.agent(app);

  await register(leaderAgent, {
    username: 'ai_leader',
    email: 'ai_leader@test.dev',
    password: 'password123',
  });
  await register(outsiderAgent, {
    username: 'ai_outsider',
    email: 'ai_outsider@test.dev',
    password: 'password123',
  });

  const group = await createGroup(leaderAgent, 'Restricted AI Room');
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const response = await outsiderAgent.post('/api/ai/ask').send({
    groupId: group._id,
    question: 'Summarize this room context',
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(fetchCalled, false);
});

test('POST /api/ai/upload-pdf returns clear 400 when file is missing', async () => {
  const agent = request.agent(app);
  await register(agent, {
    username: 'ai_upload_user',
    email: 'ai_upload_user@test.dev',
    password: 'password123',
  });
  const group = await createGroup(agent, 'Upload AI Room');

  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const response = await agent.post('/api/ai/upload-pdf').field('groupId', group._id);

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'FILE_REQUIRED');
  assert.equal(fetchCalled, false);
});

test('POST /api/ai/ask returns 502 with clear code when upstream AI proxy fails', async () => {
  const agent = request.agent(app);
  await register(agent, {
    username: 'ai_proxy_user',
    email: 'ai_proxy_user@test.dev',
    password: 'password123',
  });
  const group = await createGroup(agent, 'Proxy Failure Room');

  global.fetch = async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:8000');
  };

  const response = await agent.post('/api/ai/ask').send({
    groupId: group._id,
    question: 'Why did the AI fail?',
  });

  assert.equal(response.status, 502);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'AI_PROXY_ERROR');
  assert.match(response.body.error.message, /ECONNREFUSED|Failed to fetch answer/i);
});
