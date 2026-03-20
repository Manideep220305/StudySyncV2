const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_123456';

const app = require('../app');
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

test('register then fetch /me returns authenticated user', async () => {
  const agent = request.agent(app);

  const registerResponse = await agent.post('/api/auth/register').send({
    username: 'alice',
    email: 'alice@test.dev',
    password: 'password123',
  });

  assert.equal(registerResponse.status, 201);
  assert.equal(registerResponse.body.success, true);
  assert.equal(registerResponse.body.data.username, 'alice');

  const meResponse = await agent.get('/api/auth/me');
  assert.equal(meResponse.status, 200);
  assert.equal(meResponse.body.success, true);
  assert.equal(meResponse.body.data.email, 'alice@test.dev');
});
