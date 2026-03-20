# StudySync Backend Documentation

## 1. Scope

This document covers only the backend service inside the backend folder.

It explains:
- system architecture
- backend folder structure
- request flow from routes to controllers to models/services
- real-time socket logic
- JWT + cookie based authentication flow
- implemented backend features
- missing or improvable areas

Frontend details are intentionally excluded.

---

## 2. Backend Architecture Overview

### 2.1 High-level design

The backend uses a layered Node.js architecture with MongoDB:
- API layer: Express routes and middleware
- Business layer: Controllers and services
- Data layer: Mongoose models and MongoDB collections
- Realtime layer: Socket.IO namespace for group chat and quiz events

### 2.2 Runtime components

Core runtime files:
- server.js: process entrypoint, environment loading, Mongo connection, HTTP server + Socket.IO boot
- app.js: Express app configuration, middleware registration, HTTP route mounting
- socket.js: Socket.IO initialization, socket auth middleware, realtime event handlers

### 2.3 Startup sequence

1. Environment variables are loaded.
2. MongoDB connection is established.
3. Legacy index compatibility check runs for groups collection.
4. HTTP server is created from Express app.
5. Socket.IO server is attached to HTTP server.
6. Server starts listening on configured port.

### 2.4 Core architectural choices

- Cookie-based auth for both REST and sockets
- Middleware-first authorization (protect + requireRole)
- Junction collection for group membership (Membership)
- Centralized points writing via points service
- In-memory quiz session store (v1) for fast iteration

---

## 3. Folder Structure (Backend)

## 3.1 Top-level backend files

- app.js
  - Express middleware and route registration.

- server.js
  - DB connect + HTTP/Socket server bootstrap.

- socket.js
  - Namespace-based realtime chat and quiz broadcasts.

- package.json
  - Backend dependencies and scripts.

- .env
  - Runtime secrets/config (MONGO_URI, JWT_SECRET, PORT, CLIENT_URL, etc.).

## 3.2 Controllers

controllers contains endpoint handlers:
- authController.js
- taskController.js
- groupController.js
- memberController.js
- quizController.js
- pointsController.js
- leaderboardController.js
- profileController.js

## 3.3 Middleware

middleware contains reusable request guards:
- authMiddleware.js
  - protect
  - requireRole

## 3.4 Models

models defines Mongo schema and indexes:
- User.js
- Group.js
- Membership.js
- Task.js
- PointEvent.js
- QuizAttempt.js
- Message.js

## 3.5 Routes

routes maps URL paths to controllers:
- authRoutes.js
- taskRoutes.js
- groupRoutes.js
- memberRoutes.js
- quizRoutes.js
- pointsRoutes.js
- leaderboardRoutes.js
- profileRoutes.js

## 3.6 Services

services contains shared business logic:
- pointsService.js
- quizSessionService.js

## 3.7 Scripts

scripts includes utility jobs:
- seedRealisticTestData.js

---

## 4. Request Flow: Routes -> Controllers -> Models/Services

### 4.1 How flow works in this codebase

Standard request path:
1. Route match in routes/*.js
2. Optional middleware execution (protect, requireRole)
3. Controller execution in controllers/*.js
4. Data writes/reads via models and optional services
5. JSON response returned

### 4.2 Auth routes flow

Base path: /api/auth

- POST /register
  - Route: authRoutes
  - Controller: registerUser
  - Models: User
  - Side effects:
    - creates user (password hash in pre-save hook)
    - signs JWT
    - sets httpOnly jwt cookie

- POST /login
  - Route: authRoutes
  - Controller: loginUser
  - Models: User
  - Side effects:
    - verifies password
    - signs JWT
    - sets httpOnly jwt cookie

- POST /logout
  - Route: authRoutes
  - Controller: logoutUser
  - Side effects:
    - expires jwt cookie

- GET /me
  - Route: authRoutes
  - Middleware: protect
  - Controller: getMe
  - Source of truth: req.user from middleware

### 4.3 Task routes flow

Base path: /api/tasks

- GET /
  - Middleware: protect
  - Controller: getTasks
  - Model: Task

- POST /
  - Middleware: protect
  - Controller: createTask
  - Model: Task

- PUT /:id
  - Middleware: protect
  - Controller: updateTask
  - Models/Service: Task + pointsService.awardPoints
  - Rule:
    - XP awarded only on first incomplete -> complete transition

- DELETE /:id
  - Middleware: protect
  - Controller: deleteTask
  - Model: Task

### 4.4 Group routes flow

Base path: /api/groups

- POST /
  - Middleware: protect
  - Controller: createGroup
  - Models: Group + Membership
  - Notes:
    - creates joinCode and inviteCode
    - creates leader membership
    - rollback group if membership creation fails

- GET /
  - Middleware: protect
  - Controller: getUserGroups
  - Models: Membership + Group
  - Aggregation:
    - member counts grouped per groupId

- GET /public
  - Controller: getGroups
  - Model: Group
  - Notes:
    - supports optional tag filter

- POST /join
  - Middleware: protect
  - Controller: joinGroup
  - Models: Group + Membership
  - Notes:
    - accepts joinCode/inviteCode fallback
    - unique index prevents duplicate joins

- GET /:groupId
  - Middleware: protect
  - Controller: getGroupById
  - Model: Group

- DELETE /:groupId
  - Middleware: protect + requireRole(leader)
  - Controller: deleteGroup
  - Models: Group + Membership
  - Notes:
    - uses transaction session

- PUT /:groupId/code
  - Middleware: protect + requireRole(leader)
  - Controller: resetJoinCode
  - Model: Group

### 4.5 Member routes flow

Mounted under: /api/groups/:groupId/members

- GET /
  - Middleware: protect
  - Controller: getGroupMembers
  - Model: Membership (populate user)

- DELETE /:userId
  - Middleware: protect + requireRole(leader)
  - Controller: kickMember
  - Model: Membership
  - Rule:
    - leader cannot be kicked

- PATCH /:userId
  - Middleware: protect + requireRole(leader)
  - Controller: promoteToLeader
  - Model: Membership
  - Rule:
    - role transfer leader <-> member

### 4.6 Quiz routes flow

Mounted under: /api/groups/:groupId/quiz

- POST /start
  - Middleware: protect + requireRole(leader)
  - Controller: startGroupQuiz
  - Model/Service: Group + quizSessionService.startQuiz
  - Realtime:
    - emits quiz-started to group room

- GET /current
  - Middleware: protect
  - Controller: getCurrentGroupQuiz
  - Model/Service: Membership + quizSessionService.getActiveQuiz

- POST /answer
  - Middleware: protect
  - Controller: answerGroupQuiz
  - Models/Services:
    - Membership check
    - quizSessionService.answerQuestion
    - pointsService.awardPoints (first-correct only)
  - Realtime:
    - emits quiz-answer-result
    - emits leaderboard-updated on first-correct
    - emits quiz-finished with summary when done

### 4.7 Points routes flow

Base path: /api/points

- POST /pomodoro
  - Middleware: protect
  - Controller: logPomodoroCompletion
  - Models/Service: Membership check (if groupId) + pointsService.awardPoints

- POST /quiz-correct
  - Middleware: protect
  - Controller: logQuizCorrect
  - Models/Service: Membership check + pointsService.awardPoints

- POST /quiz-attempt
  - Middleware: protect
  - Controller: logQuizAttempt
  - Models/Service: QuizAttempt + optional pointsService.awardPoints

### 4.8 Leaderboard routes flow

Base path: /api/leaderboard

- GET /global
  - Middleware: protect
  - Controller: getGlobalLeaderboard
  - Model: User
  - Source: pre-aggregated user.totalPoints

- GET /group/:groupId
  - Middleware: protect
  - Controller: getGroupLeaderboard
  - Models: Membership + PointEvent aggregate + User lookup

### 4.9 Profile routes flow

Base path: /api/profile

- GET /me
  - Middleware: protect
  - Controller: getMyProfile
  - Models:
    - User
    - Membership count
    - PointEvent aggregates and recent history

- GET /accuracy
  - Middleware: protect
  - Controller: getMyAccuracy
  - Model: QuizAttempt aggregate
  - Output:
    - current 7-day vs previous 7-day per-topic accuracy

---

## 5. Socket.IO Logic

### 5.1 Namespace and authentication

Socket server creates namespace /study.

Socket auth middleware:
- reads raw cookie header from handshake
- parses cookie string
- extracts jwt cookie
- verifies JWT with JWT_SECRET
- loads user from DB
- stores socket.userId and socket.user

If auth fails, connection is rejected.

### 5.2 Room model

Room identity is the group join code string.

On join-group event:
- normalize joinCode to uppercase
- resolve group by joinCode or inviteCode
- verify membership exists for socket user
- leave previous room if present
- join new room
- save socket.groupCode and socket.groupId
- fetch last 50 messages and emit message-history to requester
- emit user-joined to room peers

### 5.3 Chat events

send-message event:
- requires active joined room
- validates non-empty text
- re-checks membership
- persists message document
- populates sender
- emits new-message to room

typing event:
- emits typing state to room peers

disconnect event:
- sends typing false cleanup to room

### 5.4 Quiz-related realtime broadcasts

Quiz controllers use socket namespace reference to broadcast to group room:
- quiz-started
- quiz-answer-result
- leaderboard-updated
- quiz-finished

This keeps quiz progression and leaderboard updates synchronized for all connected members.

### 5.5 Current socket constraints

- Single namespace only
- No Redis adapter wiring currently in runtime path
- No explicit rate limiting on chat events
- Room authorization depends on membership checks at join/send time

---

## 6. Auth Flow (JWT + Cookies)

### 6.1 REST authentication strategy

Auth token format:
- JWT signed with JWT_SECRET
- payload contains user id
- expiration 30 days

Token transport:
- token stored in cookie named jwt
- httpOnly enabled
- secure enabled in production only
- sameSite set to strict

### 6.2 Registration flow

1. Validate uniqueness by email.
2. Create user.
3. Password is hashed by User pre-save hook.
4. Generate JWT.
5. Set jwt cookie.
6. Return user profile fields.

### 6.3 Login flow

1. Find user by email, include hidden password.
2. Compare password using bcrypt method.
3. Generate JWT.
4. Set jwt cookie.
5. Return profile fields.

### 6.4 Protected route flow

1. protect middleware reads req.cookies.jwt.
2. JWT is verified.
3. User is loaded and attached to req.user.
4. Controller uses req.user context.

If any step fails, request returns 401.

### 6.5 Role-based authorization flow

requireRole(role) middleware:
- reads groupId from params or body
- queries Membership for req.user + groupId
- checks membership role
- returns 403 on mismatch

Used for leader-only group/member actions and quiz start.

### 6.6 Socket authentication flow

1. Client connects to /study with cookies.
2. Namespace middleware parses handshake cookie.
3. jwt is verified.
4. User loaded and attached to socket context.
5. Authorized socket can join groups and emit events.

---

## 7. Key Features Implemented

### 7.1 User and session management

- Register/login/logout/me APIs
- Password hashing and password exclusion by default
- Cookie-based JWT auth for REST + sockets

### 7.2 Task and XP mechanics

- Task CRUD per user
- XP award on first completion transition
- XP event audit trail through PointEvent

### 7.3 Group collaboration model

- Public group discovery by tags
- Group creation with auto-generated join code
- Join by code with duplicate membership prevention
- Leader/member roles and role-gated operations

### 7.4 Member administration

- Member listing with user profile population
- Kick member endpoint
- Leadership transfer endpoint

### 7.5 Quiz lifecycle (v1)

- Group leader can start quiz session
- Members can fetch current active quiz
- Per-question answering with first-correct detection
- Scoreboard generation and quiz-finished summary
- Realtime quiz events to group room

### 7.6 Points and analytics

- Pomodoro point logging
- Quiz correct point logging
- Quiz attempt logging with topic and difficulty
- Global leaderboard from totalPoints
- Group leaderboard from PointEvent aggregation
- Profile summary + per-topic accuracy trend

### 7.7 Realtime group chat

- Authenticated socket connection
- Room join by group code
- Last 50 message history on join
- Live new-message and typing events

---

## 8. Missing or Improvable Parts

### 8.1 Reliability and scaling

- Quiz sessions are in-memory; server restart loses active sessions.
- Multi-instance deployments need shared state (Redis) for quiz and socket rooms.
- Redis adapter dependency exists but is not currently wired in startup.

### 8.2 Security hardening

- No request rate limiting for auth and socket events.
- No brute-force protection for login/join code attempts.
- No CSRF strategy beyond sameSite strict cookie policy.
- JWT rotation/refresh token pattern is not implemented.

### 8.3 Data consistency and transactions

- pointsService updates PointEvent and User in separate writes (no transaction).
- Some multi-step role/group operations can be wrapped in stronger transaction boundaries.

### 8.4 Validation and error handling

- Input validation is mostly manual and inconsistent across endpoints.
- No centralized validation layer/schema validator (for example zod/joi/express-validator).
- No centralized error middleware; repeated try/catch and response shapes vary.

### 8.5 API maintainability

- API contract docs (OpenAPI/Swagger) are missing.
- Versioning strategy for APIs is not defined.
- Response format is not fully standardized (message vs payload structures differ).

### 8.6 Observability and operations

- Logging is console based; no structured logger integration.
- No request tracing or correlation IDs.
- No metrics endpoint or monitoring hooks.
- Health check exists but is basic and does not verify downstream dependencies.

### 8.7 Testing and CI

- Automated backend test coverage is not visible in current backend folder.
- Integration tests for auth, roles, points, and socket events should be added.
- Load tests for chat/quiz bursts are not present.

### 8.8 Domain-level refinements

- Group deletion does not explicitly cascade message cleanup.
- Join code uniqueness collision retry exists in createGroup but not in resetJoinCode.
- Role transfer logic could enforce stricter invariants under concurrent requests.
- Quiz scoring model is intentionally simple and can evolve (weighted by difficulty/time).

---

## 9. Practical Next Backend Milestones

1. Persist quiz sessions in Redis and enable socket redis adapter.
2. Add global validation + centralized error middleware.
3. Add auth and socket rate limiting.
4. Add transactional integrity in points writes.
5. Publish OpenAPI spec and API examples.
6. Add automated integration tests for critical flows.

---

## 10. Summary

The backend is a solid v1 collaboration API with:
- modular route/controller/model separation
- role-protected group workflows
- realtime chat and quiz synchronization
- points and leaderboard analytics

The main next step is hardening for production scale: persistent realtime state, stronger validation/security controls, and consistent operational tooling.
