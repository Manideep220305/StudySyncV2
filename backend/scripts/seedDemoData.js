/* eslint-disable no-console */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const User = require('../models/User');
const Group = require('../models/Group');
const Membership = require('../models/Membership');
const Message = require('../models/Message');

dotenv.config();

const DEMO_PASSWORD = 'demo123';

// These accounts are intentionally predictable so QA can log in and verify the demo flow fast.
const DEMO_USERS = [
  // The first account is the one you log into during demos.
  {
    email: 'demo@studysync.dev',
    username: 'demo',
    bio: 'Primary demo account for StudySync walkthroughs',
  },
  {
    email: 'anya@studysync.dev',
    username: 'anya.study',
    bio: 'Keeps the DSA sprint room moving',
  },
  {
    email: 'miles@studysync.dev',
    username: 'miles.builds',
    bio: 'Frontend builder and note cleaner',
  },
  {
    email: 'rhea@studysync.dev',
    username: 'rhea.rev',
    bio: 'Exam review captain',
  },
];

const DEMO_GROUPS = [
  // This room showcases the study/chat flow with a classic DSA angle.
  {
    name: 'DSA Sprint Room',
    description: 'Quick problem solving, interview drills, and daily accountability.',
    // Fixed join codes make the demo easy to share in screenshots or walkthroughs.
    joinCode: 'DEMO01',
    tags: ['dsa', 'interview', 'study'],
    files: ['two-pointer-notes.pdf', 'binary-tree-drills.pdf'],
    messages: [
      { user: 'demo@studysync.dev', text: 'Kicking off with 3 array problems before lunch.' },
      { user: 'anya@studysync.dev', text: 'I dropped the two-pointer notes in files for anyone joining late.' },
      { user: 'miles@studysync.dev', text: 'Starting a 25-minute focus block now.' },
      { user: 'rhea@studysync.dev', text: "I'm in for the recap after the first round." },
    ],
  },
  // This room makes the app feel like a real project team, not only a study club.
  {
    name: 'MERN Build Lab',
    description: 'Shipping project features, debugging API calls, and reviewing UI polish.',
    // Each room gets its own stable code so the UI can point to a specific scenario.
    joinCode: 'DEMO02',
    tags: ['mern', 'development', 'project'],
    files: ['api-checklist.md', 'ui-review.png'],
    messages: [
      { user: 'demo@studysync.dev', text: "Dashboard copy feels clearer after today's pass." },
      { user: 'miles@studysync.dev', text: 'I added the API checklist so nobody has to guess the next step.' },
      { user: 'anya@studysync.dev', text: 'Join code is in the group description if anyone needs it.' },
      { user: 'demo@studysync.dev', text: 'Nice, this now looks like an actual project room instead of a placeholder.' },
    ],
  },
  // This room gives the dashboard a calmer, exam-review style demo path.
  {
    name: 'Exam Review Circle',
    description: 'Lightweight revision sessions, quick questions, and end-of-week catchups.',
    // A third room keeps the app from feeling like a two-state toy demo.
    joinCode: 'DEMO03',
    tags: ['college', 'revision', 'study'],
    files: ['week-6-outline.pdf'],
    messages: [
      { user: 'rhea@studysync.dev', text: "Tonight's review plan is 20 minutes per chapter." },
      { user: 'demo@studysync.dev', text: "I'll take the first half and post my notes after." },
      { user: 'anya@studysync.dev', text: 'Perfect. That keeps the session short enough to actually finish.' },
      { user: 'rhea@studysync.dev', text: 'That is the goal: less chaos, more finished revision.' },
    ],
  },
];

const ensureUser = async ({ email, username, bio }) => {
  let user = await User.findOne({ email }).select('+password');

  if (!user) {
    // Create the demo user the first time, then reuse the same record on later seed runs.
    user = new User({
      email,
      username,
      password: DEMO_PASSWORD,
      bio,
    });
  } else {
    user.username = username;
    user.password = DEMO_PASSWORD;
    user.bio = bio;
  }

  await user.save();
  return user;
};

const seedGroup = async (groupSpec, usersByEmail) => {
  const leader = usersByEmail.get('demo@studysync.dev');
  // Upsert by join code so the demo rooms stay stable instead of multiplying on every seed.
  const group = await Group.findOneAndUpdate(
    { joinCode: groupSpec.joinCode },
    {
      $set: {
        name: groupSpec.name,
        description: groupSpec.description,
        tags: groupSpec.tags,
        joinCode: groupSpec.joinCode,
        inviteCode: groupSpec.joinCode,
        createdBy: leader._id,
        isPublic: true,
        // File names are enough for the UI preview, so we only seed lightweight metadata here.
        uploadedFiles: groupSpec.files.map((name, index) => ({
          name,
          uploadedBy: index === 0 ? leader._id : usersByEmail.get('miles@studysync.dev')._id,
          uploadedAt: new Date(Date.now() - (index + 1) * 3600000),
        })),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // Remove old child rows before inserting the fresh demo snapshot.
  await Membership.deleteMany({ groupId: group._id });
  await Message.deleteMany({ groupId: group._id });

  // Rebuild the room membership list from scratch so the chat preview always matches the seeded story.
  const memberEmails = ['demo@studysync.dev', 'anya@studysync.dev', 'miles@studysync.dev', 'rhea@studysync.dev'];
  const memberships = memberEmails.map((email) => ({
    userId: usersByEmail.get(email)._id,
    groupId: group._id,
    role: email === 'demo@studysync.dev' ? 'leader' : 'member',
  }));
  await Membership.insertMany(memberships);

  // Backdate messages slightly so the room feels active and the chat history is not all same-timestamp noise.
  // Stagger the timestamps so the thread feels like a real conversation instead of a burst insert.
  const baseTime = Date.now() - 5 * 3600000;
  const messages = groupSpec.messages.map((entry, index) => ({
    groupId: group._id,
    senderId: usersByEmail.get(entry.user)._id,
    text: entry.text,
    type: 'text',
    createdAt: new Date(baseTime + index * 900000),
    updatedAt: new Date(baseTime + index * 900000),
  }));
  await Message.insertMany(messages);

  return group;
};

const main = async () => {
  try {
    // Fail fast if the DB URL is missing instead of half-running the seed.
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing in environment');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for demo seeding');

    // Users are created first because groups, memberships, and messages all reference them.
    const users = await Promise.all(DEMO_USERS.map(ensureUser));
    const usersByEmail = new Map(users.map((user) => [user.email, user]));

    const groups = [];
    // Collect the created documents so the summary can print their names and codes together.
    // Keep the groups loop explicit so the demo story is easy to scan later.
    for (const groupSpec of DEMO_GROUPS) {
      groups.push(await seedGroup(groupSpec, usersByEmail));
    }

    // The output is a tiny runbook: who to log in as and what rooms are available.
    console.log('---- Demo Seed Summary ----');
    console.log(`Demo login: demo@studysync.dev / ${DEMO_PASSWORD}`);
    console.log(`Seeded groups: ${groups.map((group) => `${group.name} (#${group.joinCode})`).join(', ')}`);
    console.log('Each group includes members, messages, and uploaded file names.');
    console.log('Demo seeding complete.');
  } catch (error) {
    // Keep the console error short; the surrounding stack usually has the rest.
    console.error('Demo seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    // Always disconnect so repeated runs do not leave a dangling connection around.
    await mongoose.disconnect();
  }
};

main();
