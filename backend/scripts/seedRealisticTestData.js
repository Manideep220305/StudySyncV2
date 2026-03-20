/* eslint-disable no-console */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { faker } = require('@faker-js/faker');

const User = require('../models/User');
const Group = require('../models/Group');
const Membership = require('../models/Membership');
const Message = require('../models/Message');
const Task = require('../models/Task');
const PointEvent = require('../models/PointEvent');

dotenv.config();

const TEST_EMAIL = 'test1@gmail.com';
const TEST_PASSWORD = '123456';
const MIN_GROUPS_FOR_TEST_USER = 10;
const TARGET_FAKE_USERS = 45;

const REASONS = ['quiz_win', 'pomodoro', 'task_resolved'];
const CATEGORY_POOL = ['DSA', 'Development', 'College', 'Other'];

const reasonPoints = (reason) => {
  if (reason === 'quiz_win') return 50;
  if (reason === 'pomodoro') return 25;
  return faker.number.int({ min: 8, max: 20 });
};

const randomPastDate = (maxDaysAgo = 20) =>
  faker.date.recent({ days: maxDaysAgo });

const sampleUniqueUsers = (users, count) => {
  if (!users.length || count <= 0) return [];
  const copy = [...users].sort(() => Math.random() - 0.5);
  return copy.slice(0, Math.min(count, copy.length));
};

const createUniqueGroup = async (createdBy, name, description) => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = Group.generateJoinCode();
    try {
      const group = await Group.create({
        name,
        description,
        tags: ['study', faker.helpers.arrayElement(['dsa', 'mern', 'interview', 'systems'])],
        joinCode: code,
        inviteCode: code,
        createdBy,
        isPublic: true,
      });
      return group;
    } catch (error) {
      if (error?.code === 11000) continue;
      throw error;
    }
  }
  throw new Error('Could not generate unique join code after retries');
};

const ensureTestUser = async () => {
  let user = await User.findOne({ email: TEST_EMAIL }).select('+password');
  if (!user) {
    user = await User.create({
      username: 'test1',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      bio: 'Seeded test account for heavy QA',
    });
    return user;
  }

  // Keep credentials predictable for QA login.
  user.password = TEST_PASSWORD;
  if (!user.username || user.username.length < 3) {
    user.username = 'test1';
  }
  if (!user.bio) {
    user.bio = 'Seeded test account for heavy QA';
  }
  await user.save();
  return user;
};

const ensureFakeUsers = async () => {
  const existing = await User.countDocuments({ email: { $ne: TEST_EMAIL } });
  const toCreate = Math.max(TARGET_FAKE_USERS - existing, 0);

  for (let i = 0; i < toCreate; i += 1) {
    let created = false;
    for (let retries = 0; retries < 6 && !created; retries += 1) {
      const username = `${faker.internet.username().toLowerCase().replace(/[^a-z0-9_]/g, '')}${faker.number.int({ min: 100, max: 9999 })}`;
      const email = faker.internet.email({ provider: 'mailseed.dev' }).toLowerCase();
      try {
        await User.create({
          username,
          email,
          password: '123456',
          bio: faker.person.jobTitle(),
        });
        created = true;
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }
  }

  return User.find({ email: { $ne: TEST_EMAIL } }).lean();
};

const ensureGroupsForTestUser = async (testUserId) => {
  const existingGroups = await Group.find({ createdBy: testUserId }).lean();
  const toCreate = Math.max(MIN_GROUPS_FOR_TEST_USER - existingGroups.length, 0);
  const createdGroups = [];

  for (let i = 0; i < toCreate; i += 1) {
    const group = await createUniqueGroup(
      testUserId,
      `${faker.company.buzzNoun()} ${faker.word.adjective()} squad`.slice(0, 48),
      faker.company.catchPhrase().slice(0, 180)
    );
    createdGroups.push(group.toObject());
  }

  const allGroups = await Group.find({ createdBy: testUserId }).lean();
  return { allGroups, createdCount: createdGroups.length };
};

const ensureMembershipsAndMessages = async (groups, fakeUsers, testUserId) => {
  let membershipOps = 0;
  let messageInsertCount = 0;

  for (const group of groups) {
    // Ensure leader membership for test user always exists.
    await Membership.findOneAndUpdate(
      { userId: testUserId, groupId: group._id },
      { role: 'leader' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const desiredMemberCount = faker.number.int({ min: 6, max: 14 });
    const sampled = sampleUniqueUsers(fakeUsers, desiredMemberCount);

    for (const member of sampled) {
      await Membership.findOneAndUpdate(
        { userId: member._id, groupId: group._id },
        { role: 'member' },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      membershipOps += 1;
    }

    const groupMemberships = await Membership.find({ groupId: group._id }).lean();
    const senderIds = groupMemberships.map((membership) => membership.userId);

    const existingMessageCount = await Message.countDocuments({ groupId: group._id });
    const targetMessages = 60;
    const toCreate = Math.max(targetMessages - existingMessageCount, 0);

    if (toCreate > 0 && senderIds.length > 0) {
      const docs = Array.from({ length: toCreate }).map(() => {
        const createdAt = randomPastDate(14);
        return {
          groupId: group._id,
          senderId: faker.helpers.arrayElement(senderIds),
          text: faker.helpers.arrayElement([
            faker.hacker.phrase(),
            faker.company.catchPhrase(),
            faker.lorem.sentence(),
            `Today's target: ${faker.number.int({ min: 2, max: 8 })} problems solved`,
            `Revision block starts in ${faker.number.int({ min: 5, max: 25 })} mins`,
          ]).slice(0, 220),
          type: 'text',
          createdAt,
          updatedAt: createdAt,
        };
      });
      await Message.insertMany(docs, { ordered: false });
      messageInsertCount += docs.length;
    }
  }

  return { membershipOps, messageInsertCount };
};

const ensureTasksForTestUser = async (testUserId) => {
  const existingCount = await Task.countDocuments({ userId: testUserId });
  const target = 25;
  const toCreate = Math.max(target - existingCount, 0);

  if (toCreate <= 0) return 0;

  const docs = Array.from({ length: toCreate }).map(() => {
    const completed = faker.datatype.boolean({ probability: 0.4 });
    const createdAt = randomPastDate(21);
    return {
      userId: testUserId,
      title: faker.helpers.arrayElement([
        `Solve ${faker.number.int({ min: 2, max: 7 })} DSA questions`,
        `Revise ${faker.word.noun()} notes`,
        `Build ${faker.word.adjective()} API module`,
        `Mock interview round ${faker.number.int({ min: 1, max: 6 })}`,
      ]),
      isCompleted: completed,
      xpValue: faker.number.int({ min: 8, max: 30 }),
      category: faker.helpers.arrayElement(CATEGORY_POOL),
      createdAt,
      updatedAt: createdAt,
    };
  });

  await Task.insertMany(docs, { ordered: false });
  return docs.length;
};

const ensurePointEvents = async (groups, testUserId) => {
  const userPointIncrements = new Map();
  let insertedEvents = 0;

  for (const group of groups) {
    const existingForGroup = await PointEvent.countDocuments({ groupId: group._id });
    if (existingForGroup >= 120) continue;

    const members = await Membership.find({ groupId: group._id }).lean();
    if (!members.length) continue;

    const docs = [];
    const eventsToAdd = faker.number.int({ min: 35, max: 60 });
    for (let i = 0; i < eventsToAdd; i += 1) {
      const member = faker.helpers.arrayElement(members);
      const reason = faker.helpers.arrayElement(REASONS);
      const points = reasonPoints(reason);
      const createdAt = randomPastDate(30);

      docs.push({
        userId: member.userId,
        groupId: group._id,
        points,
        reason,
        createdAt,
        updatedAt: createdAt,
      });

      const key = String(member.userId);
      userPointIncrements.set(key, (userPointIncrements.get(key) || 0) + points);
    }

    if (docs.length) {
      await PointEvent.insertMany(docs, { ordered: false });
      insertedEvents += docs.length;
    }
  }

  const bulk = [];
  userPointIncrements.forEach((points, userId) => {
    bulk.push({
      updateOne: {
        filter: { _id: userId },
        update: { $inc: { totalPoints: points } },
      },
    });
  });

  // Ensure test user gets baseline points even if random assignment was low.
  if (!userPointIncrements.has(String(testUserId))) {
    bulk.push({
      updateOne: {
        filter: { _id: testUserId },
        update: { $inc: { totalPoints: 250 } },
      },
    });
  }

  if (bulk.length) {
    await User.bulkWrite(bulk);
  }

  return insertedEvents;
};

const main = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing in environment');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for seeding');

    const testUser = await ensureTestUser();
    const fakeUsers = await ensureFakeUsers();
    const { allGroups, createdCount } = await ensureGroupsForTestUser(testUser._id);
    const { membershipOps, messageInsertCount } = await ensureMembershipsAndMessages(
      allGroups,
      fakeUsers,
      testUser._id
    );
    const taskCount = await ensureTasksForTestUser(testUser._id);
    const pointEventCount = await ensurePointEvents(allGroups, testUser._id);

    console.log('---- Seed Summary ----');
    console.log(`Test user email: ${TEST_EMAIL}`);
    console.log(`Test user password reset to: ${TEST_PASSWORD}`);
    console.log(`Groups owned by test user: ${allGroups.length} (newly created: ${createdCount})`);
    console.log(`Membership upserts performed: ${membershipOps}`);
    console.log(`Messages inserted: ${messageInsertCount}`);
    console.log(`Tasks inserted for test user: ${taskCount}`);
    console.log(`Point events inserted: ${pointEventCount}`);
    console.log('Seeding complete.');
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

main();

