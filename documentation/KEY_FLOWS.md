# StudySync Key Flows Documentation

## 1. Scope

This document explains the core application flows in step-by-step form.

Included flows:
- user signup/login
- join room
- real-time session (socket flow)
- quiz flow
- AI query flow

Each flow is described as:
- frontend action
- backend handling
- database operations
- response back to client

---

## 2. System Context

Frontend stack:
- React + TypeScript + React Router
- Axios for HTTP APIs
- Socket.IO client for realtime

Backend stack:
- Node.js + Express
- Socket.IO namespace /study
- JWT auth via httpOnly cookie

Database:
- MongoDB via Mongoose
- key collections: users, groups, memberships, messages, tasks, point events, quiz attempts

Auth model:
- login/register creates JWT
- JWT stored in cookie named jwt
- protected APIs use auth middleware
- socket handshake also validates same cookie

---

## 3. Flow A: User Signup

### 3.1 Trigger (Frontend)

1. User opens auth modal from landing page.
2. User switches to Sign Up tab.
3. User enters username, email, password.
4. Frontend calls AuthContext.register(...).
5. AuthContext sends POST /api/auth/register with credentials and withCredentials: true.

### 3.2 Backend Processing

6. Express route /api/auth/register maps to registerUser controller.
7. Controller checks if email already exists in users collection.
8. If email exists, controller returns 400 with error message.
9. If not exists, controller creates a new User document.
10. User model pre-save hook hashes password using bcrypt.
11. Controller signs JWT with user id and expiry.
12. Backend sets httpOnly jwt cookie in response.
13. Controller returns sanitized user payload (without password).

### 3.3 Database Operations

14. users.insertOne equivalent via User.create(...).
15. Unique constraints enforced on username and email.
16. Stored password is hash, not plaintext.

### 3.4 Response and UI Update

17. Frontend receives success response and cookie from browser-managed storage.
18. AuthContext sets global user state.
19. Auth modal closes.
20. Frontend navigates to /dashboard.
21. ProtectedRoute now allows access because isAuthenticated is true.

---

## 4. Flow B: User Login

### 4.1 Trigger (Frontend)

1. User opens auth modal and selects Login.
2. User enters email and password.
3. Frontend calls AuthContext.login(email, password).
4. AuthContext sends POST /api/auth/login with withCredentials: true.

### 4.2 Backend Processing

5. Express route /api/auth/login maps to loginUser controller.
6. Controller finds user by email and explicitly selects password field.
7. Controller compares candidate password using bcrypt compare.
8. If invalid, returns 401 Invalid email or password.
9. If valid, signs JWT and sets httpOnly jwt cookie.
10. Returns user profile payload.

### 4.3 Database Operations

11. users.findOne({ email }) read.
12. No write required for login flow itself.

### 4.4 Response and Session Rehydration

13. Frontend stores user in AuthContext state.
14. User is redirected to /dashboard.
15. On future refresh, AuthContext boot check calls GET /api/auth/me.
16. Backend middleware verifies cookie JWT and returns current user.
17. Session persists without localStorage token handling.

---

## 5. Flow C: Join Room (Study Group)

### 5.1 Trigger (Frontend)

1. Authenticated user opens Join Group modal on Dashboard or Rooms page.
2. User enters join code (for example ABC123).
3. Frontend calls groupService.joinGroup(joinCode).
4. Axios sends POST /api/groups/join with withCredentials: true.

### 5.2 Backend Processing

5. Route maps to joinGroup controller.
6. protect middleware validates JWT cookie and attaches req.user.
7. Controller normalizes join code to uppercase.
8. Controller queries Group by joinCode or inviteCode.
9. If group not found, returns 404 Invalid join code.
10. If found, controller creates Membership(userId, groupId, role=member).
11. If duplicate membership index conflict occurs, returns already member error.
12. Returns success response with joined group object.

### 5.3 Database Operations

13. groups.findOne by joinCode/inviteCode.
14. memberships.insertOne for user-group link.
15. Compound unique index (userId + groupId) prevents duplicate joins.

### 5.4 Response and UI Update

16. Frontend receives group payload.
17. Group list state is updated.
18. Selected group state is set to joined group.
19. Group chat panel mounts using selected group context.

---

## 6. Flow D: Real-Time Session (Socket Flow)

### 6.1 Socket Connection Boot

1. Protected page mounts SocketProvider.
2. SocketProvider creates socket.io client to /study namespace.
3. withCredentials true includes auth cookie in handshake.
4. Client calls connect().

### 6.2 Backend Socket Auth

5. Socket namespace middleware reads handshake cookie header.
6. Parses cookie and extracts jwt value.
7. Verifies JWT with backend secret.
8. Loads user from users collection.
9. If valid, attaches socket.userId and socket.user.
10. If invalid, connection fails with connect_error.

### 6.3 Join Group Room

11. Frontend emits join-group with joinCode.
12. Backend validates code and membership for socket user.
13. Backend joins socket to room named by join code.
14. Backend reads recent message history (last 50) from messages collection.
15. Backend emits message-history to joining client.
16. Backend emits user-joined to other room members.

### 6.4 Live Chat Messaging

17. User types; frontend emits typing { isTyping }.
18. Backend rebroadcasts typing state to peers in same room.
19. User submits message; frontend emits send-message { text }.
20. Backend validates non-empty text and membership.
21. Backend writes Message document to DB.
22. Backend populates sender profile fields.
23. Backend emits new-message to room.
24. All connected clients append message to local state.

### 6.5 Disconnect Behavior

25. On disconnect, backend emits typing false cleanup for user.
26. UI connection badges switch to disconnected state.

---

## 7. Flow E: Quiz Flow

### 7.1 Start Quiz (Leader)

1. Leader opens quiz tab in GroupChat.
2. Leader chooses topic and question count.
3. Frontend calls quizService.startQuiz(groupId, payload).
4. Request goes to POST /api/groups/:groupId/quiz/start.

### 7.2 Backend Start Handling

5. protect middleware validates user.
6. requireRole(leader) validates leader membership role.
7. Controller validates group id and loads group.
8. Controller calls quizSessionService.startQuiz(...).
9. Service selects questions from in-memory bank and creates active session state.
10. Controller emits quiz-started via socket room (group join code).
11. Controller returns quiz snapshot.

### 7.3 Database Operations (Start)

12. groups.findById read.
13. No quiz session DB write in v1 (in-memory store used).

### 7.4 Answer Question

14. Member selects option and submits from QuizPanel.
15. Frontend calls POST /api/groups/:groupId/quiz/answer.
16. Backend validates membership in group.
17. Backend calls answerQuestion in quiz session service.
18. Service checks first-correct logic and finished state.
19. If first correct, controller calls awardPoints service.
20. awardPoints writes PointEvent and increments User.totalPoints.
21. Backend emits quiz-answer-result to room.
22. If first-correct, emits leaderboard-updated event.
23. If quiz finished, builds ranking summary and emits quiz-finished.
24. Controller returns answer result payload to caller.

### 7.5 Database Operations (Answer)

25. memberships.findOne read for authorization.
26. pointevents.insertOne when points awarded.
27. users.updateOne $inc totalPoints when points awarded.
28. users.find for scoreboard profile enrichment on finish.

### 7.6 Frontend Realtime Effects

29. QuizPanel listens to quiz-started, quiz-answer-result, quiz-finished.
30. Leaderboard page listens to leaderboard-updated and quiz-finished.
31. Leaderboard page refreshes global and group ranks after events.

---

## 8. Flow F: AI Query Flow

Important current status:
- AI query runtime is not implemented yet in this codebase.
- Existing quiz flow is non-RAG and uses local question bank.

The steps below describe target flow for planned AI subsystem.

### 8.1 Ask Notes Query (Target)

1. User opens Ask Notes UI (planned component).
2. User submits question with group context.
3. Frontend sends POST /api/ai/ask to Node backend.

4. Backend protect middleware validates JWT cookie.
5. Backend verifies user membership in target group.
6. Backend validates query length and request limits.
7. Backend proxies request to FastAPI AI service /ask.

8. AI service embeds query vector.
9. AI service retrieves top-k chunks from ChromaDB for group namespace.
10. AI service builds grounded prompt with retrieved chunks.
11. LLM generates answer + citations.
12. AI service returns structured response to Node.

13. Node normalizes response schema.
14. Node returns answer payload to frontend.
15. Frontend renders answer text and cited sources.

### 8.2 DB/Storage Operations (Target)

16. ChromaDB vector search read operations.
17. Optional query log write (if implemented).
18. Optional metrics write for latency/token usage.

### 8.3 Upload + Ingest (Target Companion Flow)

19. User uploads PDF for group knowledge base.
20. Frontend posts file to Node /api/ai/upload.
21. Node validates auth, role, file type/size.
22. Node forwards file to FastAPI ingestion endpoint.
23. FastAPI extracts text, chunks with LangChain splitter.
24. FastAPI embeds chunks and stores vectors in ChromaDB.
25. FastAPI returns ingestion report.
26. Node returns success summary to frontend.

### 8.4 Missing Pieces to Activate This Flow

27. FastAPI AI service implementation.
28. Node AI proxy routes/controllers.
29. Frontend Ask Notes UI and upload flow wiring.
30. Production-ready observability, rate limiting, and retries.

---

## 9. End-to-End Summary Matrix

Signup/Login:
- Frontend: AuthModal + AuthContext
- Backend: auth routes/controllers + JWT cookie issuance
- DB: users read/write
- Response: user payload + authenticated session cookie

Join Room:
- Frontend: groupService join action
- Backend: groups controller + membership checks
- DB: groups/memberships reads+writes
- Response: joined group and updated local state

Realtime Session:
- Frontend: SocketProvider + GroupChat events
- Backend: socket namespace auth + room broadcasting
- DB: messages write/read for history and live chat
- Response: websocket events to all room participants

Quiz Flow:
- Frontend: QuizPanel + room event listeners
- Backend: quiz controller + in-memory quiz service + points service
- DB: memberships auth reads, points writes, user score updates
- Response: quiz results + realtime leaderboard signals

AI Query Flow (Target):
- Frontend: Ask Notes query/upload UI
- Backend: AI proxy endpoints with auth/RBAC
- DB/Vector: ChromaDB retrieval and optional telemetry store
- Response: grounded answer with source citations

---

## 10. Closing Note

The first four flows are implemented and operational (auth, join room, realtime chat/session, quiz).

AI query flow is currently architectural/planned and should be treated as target-state documentation until the AI microservice and Node proxy routes are added.
