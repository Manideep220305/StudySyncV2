// app.js — Express App Configuration
// This file sets up the Express application: middleware and route mounting.
// It does NOT connect to the database or start the server — that's server.js's job.
// Exporting `app` as a module makes it easy to import in tests or server.js.

const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const { requestLogger } = require('./middleware/requestLogger');
const { responseEnvelope } = require('./middleware/responseEnvelope');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

const parseOrigins = () => {
  const configured = process.env.CORS_ORIGINS || process.env.CLIENT_URL || '';
  const values = configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length > 0) {
    return values;
  }

  return ['http://localhost:5173', 'http://localhost:5174'];
};

// --- Middleware ---
// CORS: Allows requests from the Vite frontend dev server.
// `credentials: true` is REQUIRED for the browser to send and receive httpOnly cookies.
// Without this, all auth would silently fail — the cookie would never be sent.
app.use(
  cors({
    origin: parseOrigins(),
    credentials: true, // Allow cookies (needed for JWT auth)
  })
);
app.use(requestLogger);
app.use(responseEnvelope);

// express.json() — parses incoming request bodies with 'Content-Type: application/json'
// Without this, req.body would be undefined on POST/PUT routes.
app.use(express.json());

// express.urlencoded() — parses URL-encoded form data (e.g., from HTML forms)
app.use(express.urlencoded({ extended: true }));

// cookie-parser — parses the `Cookie` header from incoming requests
// and populates req.cookies. Our `protect` middleware reads req.cookies.jwt.
app.use(cookieParser());

// --- Route Mounting ---
// Each feature has its own router file. We mount them with a URL prefix.
// This keeps the routes modular and easy to find.
app.use('/api/auth', authRoutes);                                           // Register, Login, Logout, /me
app.use('/api/tasks', require('./routes/taskRoutes'));                       // Task CRUD
app.use('/api/groups', require('./routes/groupRoutes'));                     // Group management
app.use('/api/groups/:groupId/members', require('./routes/memberRoutes'));   // Member management (nested route)
app.use('/api/groups/:groupId/quiz', require('./routes/quizRoutes'));        // Quiz mechanics (v1, non-RAG)
app.use('/api/points', require('./routes/pointsRoutes'));                    // XP event logging
app.use('/api/leaderboard', require('./routes/leaderboardRoutes'));          // Global + group leaderboard
app.use('/api/profile', require('./routes/profileRoutes'));                  // User profile analytics
app.use('/api/ai', require('./routes/aiRoutes'));                            // AI proxy endpoints -> FastAPI

// Health Check — a simple GET route to verify the server is running.
// Useful for deployment platforms (Render, Railway) to confirm the server started correctly.
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.status(200).json({
    status: dbState === 1 ? 'active' : 'degraded',
    service: 'studysync-backend',
    uptimeSec: Math.floor(process.uptime()),
    dependencies: {
      mongo: dbStateMap[dbState] || 'unknown',
      socketNamespace: Boolean(app.locals.socketInitialized),
    },
    ts: new Date().toISOString(),
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
