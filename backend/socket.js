const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const Group = require('./models/Group');
const Membership = require('./models/Membership');
const Message = require('./models/Message');
const User = require('./models/User');
const logger = require('./utils/logger');

const SOCKET_ORIGINS = (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const isLocalDevOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

const socketOriginValidator = (origin, callback) => {
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  const allowedOrigins = new Set(SOCKET_ORIGINS);

  if (!origin) {
    return callback(null, true);
  }

  if (allowedOrigins.has(origin)) {
    return callback(null, true);
  }

  if (isDev && isLocalDevOrigin(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`Socket origin not allowed: ${origin}`));
};
let studyNamespaceRef = null;

const eventLimiterStore = new Map();

const isEventLimited = (socket, eventName, maxEvents, windowMs) => {
  const now = Date.now();
  const key = `${socket.id}:${eventName}`;
  const existing = eventLimiterStore.get(key) || [];
  const recent = existing.filter((ts) => now - ts < windowMs);
  recent.push(now);
  eventLimiterStore.set(key, recent);
  return recent.length > maxEvents;
};

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: socketOriginValidator,
      credentials: true,
    },
  });

  const studyNamespace = io.of('/study');
  studyNamespaceRef = studyNamespace;

  studyNamespace.use(async (socket, next) => {
    try {
      const rawCookies = socket.handshake.headers.cookie;
      if (!rawCookies) {
        return next(new Error('No auth cookie'));
      }

      const parsedCookies = cookie.parse(rawCookies);
      const token = parsedCookies.jwt;

      if (!token) {
        return next(new Error('Missing JWT'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      return next();
    } catch (error) {
      return next(new Error('Authentication error'));
    }
  });

  studyNamespace.on('connection', (socket) => {
    logger.info('socket_connected', { userId: socket.userId, username: socket.user.username });

    socket.on('join-group', async ({ joinCode }) => {
      try {
        if (isEventLimited(socket, 'join-group', 20, 60 * 1000)) {
          return socket.emit('chat-error', 'Too many join requests, please wait');
        }

        const normalizedCode = String(joinCode || '').trim().toUpperCase();
        if (!normalizedCode) {
          return socket.emit('chat-error', 'Join code is required');
        }

        const group = await Group.findOne({
          $or: [{ joinCode: normalizedCode }, { inviteCode: normalizedCode }],
        });
        if (!group) {
          return socket.emit('chat-error', 'Invalid group code');
        }

        const membership = await Membership.findOne({
          userId: socket.userId,
          groupId: group._id,
        });

        if (!membership) {
          return socket.emit('chat-error', 'Not a group member');
        }

        if (socket.groupCode) {
          socket.leave(socket.groupCode);
        }

        socket.join(normalizedCode);
        socket.groupCode = normalizedCode;
        socket.groupId = group._id.toString();

        const recentMessages = await Message.find({ groupId: group._id })
          .populate('senderId', 'username avatar')
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();

        socket.emit('message-history', recentMessages.reverse());
        socket.to(normalizedCode).emit('user-joined', {
          userId: socket.userId,
          username: socket.user.username,
        });
      } catch (error) {
        socket.emit('chat-error', error.message);
      }
    });

    socket.on('send-message', async ({ text }) => {
      try {
        if (isEventLimited(socket, 'send-message', 40, 10 * 1000)) {
          return socket.emit('chat-error', 'You are sending messages too quickly');
        }

        const cleanedText = String(text || '').trim();

        if (!socket.groupCode || !socket.groupId) {
          return socket.emit('chat-error', 'Join a group first');
        }

        if (!cleanedText) {
          return socket.emit('chat-error', 'Message cannot be empty');
        }

        const membership = await Membership.findOne({
          userId: socket.userId,
          groupId: socket.groupId,
        });

        if (!membership) {
          return socket.emit('chat-error', 'Not a group member');
        }

        const messageDoc = await Message.create({
          groupId: socket.groupId,
          senderId: socket.userId,
          text: cleanedText,
        });

        const message = await Message.findById(messageDoc._id)
          .populate('senderId', 'username avatar')
          .lean();

        studyNamespace.to(socket.groupCode).emit('new-message', message);
      } catch (error) {
        socket.emit('chat-error', error.message);
      }
    });

    socket.on('typing', ({ isTyping }) => {
      if (isEventLimited(socket, 'typing', 80, 10 * 1000)) {
        return;
      }

      if (!socket.groupCode) {
        return;
      }

      socket.to(socket.groupCode).emit('typing', {
        userId: socket.userId,
        username: socket.user.username,
        isTyping: Boolean(isTyping),
      });
    });

    socket.on('disconnect', () => {
      if (socket.groupCode) {
        socket.to(socket.groupCode).emit('typing', {
          userId: socket.userId,
          username: socket.user.username,
          isTyping: false,
        });
      }

      logger.info('socket_disconnected', {
        userId: socket.userId,
        username: socket.user?.username || 'unknown',
      });
    });
  });

  return io;
};

const getStudyNamespace = () => studyNamespaceRef;

module.exports = { initSocket, getStudyNamespace };
