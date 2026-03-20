# StudySync Flow Guide

This document explains how the current StudySync project works right now.

It is written in simple language on purpose. The goal is that you can read this once and understand:

- how the frontend talks to the backend
- how the backend talks to MongoDB
- how realtime chat and quiz work
- how FastAPI RAG fits into the system
- which parts are live today and which parts are fallback or support logic

---

## 1. Big Picture

StudySync has 4 main pieces:

1. Frontend React app
2. Node/Express backend
3. MongoDB database
4. FastAPI RAG service for PDF-based AI

### High level architecture

```text
Browser / Frontend
    |
    | HTTP requests with cookies
    v
Node / Express backend
    |
    | reads/writes
    v
MongoDB

Browser / Frontend
    |
    | Socket.IO with cookie auth
    v
Node /study namespace

Node / Express backend
    |
    | HTTP proxy
    v
FastAPI RAG service
    |
    | in-memory vectors + embeddings
    v
ChromaDB in memory
```

### What each part is responsible for

- Frontend: screens, buttons, forms, sockets, and user interaction
- Node backend: auth, permissions, validation, DB writes, response shaping
- MongoDB: permanent app data like users, groups, memberships, messages, points, tasks
- FastAPI RAG: PDF upload, chunking, retrieval, answer generation, quiz generation

---

## 2. What Is Live Right Now

These are the current working features:

- register, login, logout, session restore
- create/join groups
- role-based access control using memberships
- group members list, kick, promote
- realtime chat with Socket.IO
- group file name storage in MongoDB
- PDF ingest for AI notes and AI quiz generation
- AI ask questions from uploaded PDFs
- AI quiz generation from uploaded PDFs
- classic quiz backend still exists as fallback logic in Node
- points, leaderboard, profile analytics, task CRUD

### Important note

The old fallback quiz UI is no longer shown in the current frontend quiz panel.
The backend classic quiz code still exists, but the visible quiz flow is now AI-first.

---

## 3. Repository Layout

### Frontend

- `frontend/src/pages/*`
- `frontend/src/components/*`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/context/SocketContext.tsx`
- `frontend/src/services/*`

### Backend

- `backend/app.js`
- `backend/socket.js`
- `backend/routes/*`
- `backend/controllers/*`
- `backend/services/*`
- `backend/models/*`
- `backend/middleware/*`

### FastAPI

- `fastapi-rag/main.py`
- `fastapi-rag/.env`
- `fastapi-rag/requirements.txt`

---

## 4. Frontend To Backend Map

This is the easiest way to understand the system.

### Frontend service calls

| Frontend file | Calls | Backend route |
|---|---|---|
| `frontend/src/context/AuthContext.tsx` | login/register/logout/me | `/api/auth/*` |
| `frontend/src/services/groupService.ts` | groups, members, files | `/api/groups/*` |
| `frontend/src/services/quizService.ts` | quiz start/current/answer/end | `/api/groups/:groupId/quiz/*` |
| `frontend/src/services/pointsService.ts` | point events | `/api/points/*` |
| `frontend/src/services/leaderboardService.ts` | leaderboard | `/api/leaderboard/*` |
| `frontend/src/services/profileService.ts` | profile analytics | `/api/profile/*` |
| `frontend/src/services/aiService.ts` | AI upload/ask/generate quiz/health | `/api/ai/*` |

### Realtime frontend files

| Frontend file | Realtime use |
|---|---|
| `frontend/src/context/SocketContext.tsx` | connects to Socket.IO `/study` namespace |
| `frontend/src/components/GroupChat.tsx` | join room, send message, typing, receive history |
| `frontend/src/components/QuizPanel.tsx` | receives quiz events and answer/finish updates |

---

## 5. Backend Route Mounting

`backend/app.js` mounts the routes like this:

```text
/api/auth               -> authRoutes
/api/tasks              -> taskRoutes
/api/groups             -> groupRoutes
/api/groups/:groupId/members -> memberRoutes
/api/groups/:groupId/quiz     -> quizRoutes
/api/points             -> pointsRoutes
/api/leaderboard        -> leaderboardRoutes
/api/profile            -> profileRoutes
/api/ai                 -> aiRoutes
```

It also exposes:

- `GET /health`

The backend health response tells you:

- service name
- uptime
- MongoDB state
- whether Socket.IO namespace was initialized

---

## 6. Startup Flow

### Backend startup

1. `backend/server.js` loads env vars.
2. It connects to MongoDB.
3. It starts the Express app.
4. It initializes Socket.IO.
5. It listens on the backend port, usually `5000`.

### Frontend startup

1. React starts from `frontend/src/main.tsx`.
2. `AuthProvider` checks `/api/auth/me`.
3. If the cookie is valid, the user session is restored.
4. `SocketProvider` connects to the `/study` namespace.

### FastAPI startup

1. `fastapi-rag/main.py` loads `.env`.
2. It starts FastAPI on port `8000`.
3. It loads the embedding model.
4. It prepares in-memory ChromaDB.

---

## 7. Authentication Flow

StudySync uses JWT in an httpOnly cookie.

That means:

- frontend does not store the token in localStorage
- browser sends the cookie automatically
- both REST requests and Socket.IO handshake can use the same login session

### Login / register / restore

```text
Frontend auth form
    -> AuthContext
    -> POST /api/auth/register or /api/auth/login
    -> authController
    -> MongoDB User collection
    -> JWT cookie is set
    -> frontend user state updates
```

### Session restore

```text
Frontend load
    -> GET /api/auth/me
    -> protect middleware reads cookie
    -> user is fetched from MongoDB
    -> current user is returned
```

### Logout

```text
Frontend logout button
    -> POST /api/auth/logout
    -> backend clears cookie
    -> frontend user state resets
```

### Auth routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### DB connection

Auth writes to:

- `users` collection

The user schema stores things like:

- username
- email
- password hash
- avatar
- total points

---

## 8. Group and RBAC Flow

StudySync does not treat a group as just one object.
It uses a membership layer.

### Why membership matters

A user can belong to many groups.
A group can have many users.
Each user has a role inside each group.

That is why the system uses a membership collection.

### Group creation flow

```text
Frontend create group form
    -> groupService.createGroup()
    -> POST /api/groups
    -> groupController.createGroup
    -> MongoDB Group insert
    -> MongoDB Membership insert with role=leader
```

### Join group flow

```text
Frontend join form
    -> groupService.joinGroup()
    -> POST /api/groups/join
    -> backend checks join code
    -> MongoDB Membership insert with role=member
```

### Load my groups

```text
Frontend dashboard / rooms page
    -> GET /api/groups
    -> backend reads Membership documents for current user
    -> backend populates related Group docs
    -> frontend gets group cards with role and memberCount
```

### Group member management

Current routes:

- `GET /api/groups/:groupId/members`
- `DELETE /api/groups/:groupId/members/:userId`
- `PATCH /api/groups/:groupId/members/:userId`

Leader-only actions:

- kick a member
- promote a member to leader

### Group details and files

Current routes:

- `GET /api/groups/:groupId`
- `GET /api/groups/:groupId/files`
- `POST /api/groups/:groupId/files`
- `PUT /api/groups/:groupId/code`

Files are stored as metadata only in MongoDB.

That means:

- the actual PDF is not permanently saved in MongoDB
- only the file name and metadata are stored in the group record
- the PDF itself is sent to FastAPI for RAG indexing

### Group storage in MongoDB

Main collections involved:

- `groups`
- `memberships`

The group document stores:

- name
- description
- join code
- uploaded file names
- maybe other display metadata

The membership document stores:

- userId
- groupId
- role

---

## 9. Realtime Socket Flow

Socket.IO is used for live chat and live quiz updates.

### Socket connection

```text
Frontend SocketContext
    -> io(`${SOCKET_ORIGIN}/study`, { withCredentials: true })
    -> backend socket auth reads JWT cookie
    -> user is attached to socket
```

### Socket namespace

The namespace is:

- `/study`

### Socket auth

The backend reads the JWT cookie during handshake.
If the cookie is missing or invalid, the socket connection fails.

### Join group room

```text
GroupChat
    -> emit join-group { joinCode }
    -> backend checks group and membership
    -> socket joins room = normalized join code
    -> backend sends last 50 messages as message-history
```

### Send message

```text
Frontend message box
    -> emit send-message
    -> backend validates membership
    -> backend writes Message to MongoDB
    -> backend emits new-message to room
```

### Typing indicator

```text
Frontend typing
    -> emit typing
    -> backend rebroadcasts to room
```

### Socket events in use

- `join-group`
- `message-history`
- `user-joined`
- `send-message`
- `new-message`
- `typing`
- `quiz-started`
- `quiz-answer-result`
- `leaderboard-updated`
- `quiz-finished`

### DB connection for chat

Chat messages are stored in MongoDB `messages` collection.

Each message has:

- groupId
- senderId
- text
- type
- timestamps

---

## 10. Chat Page Flow

The chat area does more than plain messaging.

### Chat features

- realtime messages
- typing indicator
- direct file upload
- AI ask mode inside the chat composer
- AI answer card with close button

### How chat file upload works

1. User uploads a PDF in chat.
2. Frontend saves the file name in the group metadata route.
3. Frontend sends the PDF to the AI proxy route for indexing.
4. Node forwards the PDF to FastAPI.
5. FastAPI extracts text, chunks it, and stores vectors in ChromaDB.

So the important split is:

- MongoDB keeps the file name metadata
- FastAPI keeps the searchable PDF context in memory

### Ask Notes flow from chat

```text
User types a question
    -> frontend aiService.ask()
    -> POST /api/ai/ask
    -> Node checks membership
    -> Node proxies to FastAPI /ask
    -> FastAPI searches ChromaDB
    -> Groq writes answer
    -> answer + sources return to UI
```

---

## 11. Task and Points Flow

### Task CRUD

Current routes:

- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

Frontend usually calls these from the task or dashboard screens.

### Task points

When a task is completed, the backend can award points.

That flow goes through the centralized points service.

### Points routes

- `POST /api/points/pomodoro`
- `POST /api/points/quiz-correct`
- `POST /api/points/quiz-attempt`

### Why points are centralized

Because the app uses one scoring pipeline for:

- task completion
- pomodoro completion
- quiz wins

This makes leaderboard and profile analytics much easier.

### DB collections

- `pointevents`
- `users`

The user total points are updated in MongoDB.

---

## 12. Leaderboard and Profile Flow

### Leaderboard

Routes:

- `GET /api/leaderboard/global`
- `GET /api/leaderboard/group/:groupId`

The frontend leaderboard page reads these and shows ranked users.

### Profile

Routes:

- `GET /api/profile/me`
- `GET /api/profile/accuracy`

The profile page uses these for:

- total points
- rank
- recent activity
- topic accuracy trends

### DB data used

- `users`
- `memberships`
- `pointevents`
- `quizattempts`

---

## 13. Quiz Flow

Quiz is one of the most important parts of the app.

There are two quiz layers now:

1. live quiz runtime in Node
2. AI-generated quiz questions from FastAPI

### 13.1 Classic live quiz runtime

This is the Node-side quiz session system.
It stores the current active quiz in memory.

Important service:

- `backend/services/quizSessionService.js`

Important controller:

- `backend/controllers/quizController.js`

#### Classic quiz flow

```text
Leader starts quiz
    -> POST /api/groups/:groupId/quiz/start
    -> quizSessionService.startQuiz()
    -> quiz-started socket event
    -> members answer
    -> POST /api/groups/:groupId/quiz/answer
    -> quizSessionService.answerQuestion()
    -> first-correct answer can award points
    -> quiz-finished event when done
```

#### Classic quiz routes

- `POST /api/groups/:groupId/quiz/start`
- `GET /api/groups/:groupId/quiz/current`
- `POST /api/groups/:groupId/quiz/answer`
- `POST /api/groups/:groupId/quiz/end`

### 13.2 AI quiz generation

This is the newer flow that uses FastAPI.

#### AI quiz flow

```text
QuizPanel
    -> aiService.generateQuiz(groupId, numQuestions)
    -> POST /api/ai/generate-quiz
    -> Node checks membership and leader role
    -> Node forwards request to FastAPI /generate-quiz
    -> FastAPI reads indexed PDF chunks from ChromaDB
    -> Groq creates MCQs
    -> Node maps AI questions into the live quiz session
    -> Node emits quiz-started to the room
```

#### What the frontend sees

The frontend does not need a separate quiz UI for AI.
It uses the same quiz display and answer flow.

That is the clean part of this architecture:

- question source changes
- quiz UI stays the same

### 13.3 Quiz scoring and scorecard

When a quiz ends:

- Node computes a scoreboard
- users are ranked
- the frontend shows a completion card

The scorecard now includes:

- winner
- top players
- full ranking

There is also a leader-only `End Quiz` control to clear stuck sessions.

### 13.4 Quiz data stored in MongoDB

Quiz runtime itself is in memory.

But quiz side effects are persistent:

- points
- attempts
- leaderboard updates

The quiz attempt analytics are stored through the points pipeline and quiz attempt collection.

---

## 14. FastAPI RAG Flow

This is the AI document system.

It lives in:

- `fastapi-rag/main.py`

### What FastAPI does

- accepts PDF upload
- extracts text using PyMuPDF
- splits text into chunks
- creates embeddings with `sentence-transformers`
- stores vectors in in-memory ChromaDB
- answers questions using Groq
- generates AI quizzes using Groq

### FastAPI endpoints

- `GET /health`
- `POST /upload-pdf`
- `POST /generate-quiz`
- `POST /ask`

### AI architecture

```text
Frontend
    -> Node /api/ai/*
    -> FastAPI /upload-pdf, /ask, /generate-quiz
    -> ChromaDB in memory
    -> Groq LLM
```

### Why Node sits in front of FastAPI

Node is still the main app backend.
So it handles:

- login session checks
- group membership checks
- leader-only checks
- input validation
- error normalization

Then it proxies to FastAPI.

That keeps the AI service isolated and simpler.

### PDF upload flow

```text
User uploads PDF
    -> frontend aiService.uploadPdf()
    -> POST /api/ai/upload-pdf
    -> Node checks file and membership
    -> Node sends file to FastAPI
    -> FastAPI extracts text
    -> FastAPI chunks text
    -> FastAPI stores vectors in ChromaDB
    -> FastAPI returns ingest report
```

### Ask flow

```text
Question from user
    -> POST /api/ai/ask
    -> Node checks membership
    -> Node forwards to FastAPI /ask
    -> FastAPI retrieves top chunks
    -> Groq writes answer
    -> response includes answer and sources
```

### AI quiz flow

```text
User clicks Generate AI Quiz
    -> POST /api/ai/generate-quiz
    -> Node checks membership and leader role
    -> FastAPI retrieves relevant chunks
    -> Groq generates MCQs
    -> Node starts the live quiz session
    -> socket emits quiz-started
```

### Important FastAPI detail

FastAPI stores vectors in memory only.

That means:

- if the FastAPI service restarts, the PDF context is lost
- the PDF file itself is not permanently stored
- the frontend may need to upload again after restart

This is intentional for the current demo setup.

---

## 15. Exact Backend Route Reference

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Tasks

- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

### Groups

- `POST /api/groups`
- `GET /api/groups`
- `GET /api/groups/public`
- `POST /api/groups/join`
- `GET /api/groups/:groupId`
- `GET /api/groups/:groupId/files`
- `POST /api/groups/:groupId/files`
- `DELETE /api/groups/:groupId`
- `PUT /api/groups/:groupId/code`

### Group members

- `GET /api/groups/:groupId/members`
- `DELETE /api/groups/:groupId/members/:userId`
- `PATCH /api/groups/:groupId/members/:userId`

### Quiz

- `POST /api/groups/:groupId/quiz/start`
- `GET /api/groups/:groupId/quiz/current`
- `POST /api/groups/:groupId/quiz/answer`
- `POST /api/groups/:groupId/quiz/end`

### Points

- `POST /api/points/pomodoro`
- `POST /api/points/quiz-correct`
- `POST /api/points/quiz-attempt`

### Leaderboard

- `GET /api/leaderboard/global`
- `GET /api/leaderboard/group/:groupId`

### Profile

- `GET /api/profile/me`
- `GET /api/profile/accuracy`

### AI

- `GET /api/ai/health`
- `POST /api/ai/upload-pdf`
- `POST /api/ai/generate-quiz`
- `POST /api/ai/ask`

### FastAPI

- `GET /health`
- `POST /upload-pdf`
- `POST /generate-quiz`
- `POST /ask`

---

## 16. Database Map

### MongoDB collections

- `users`
- `groups`
- `memberships`
- `messages`
- `tasks`
- `pointevents`
- `quizattempts`

### What each collection does

- `users`: auth, profile, total points
- `groups`: group info, join code, stored file names
- `memberships`: who belongs to which group and with what role
- `messages`: chat history
- `tasks`: personal or group task items
- `pointevents`: scoring history
- `quizattempts`: accuracy analytics

### In-memory data

- active quiz sessions are stored in Node memory
- PDF vectors are stored in FastAPI ChromaDB memory

This is why some data survives restart and some does not.

---

## 17. Simple "Who Talks To Who" Summary

### Frontend to Node

Frontend calls Node for:

- auth
- groups
- members
- chat and room updates
- tasks
- points
- leaderboard
- profile
- AI proxy
- quiz start/answer/end

### Node to MongoDB

Node reads/writes:

- users
- groups
- memberships
- messages
- tasks
- points
- attempts

### Node to FastAPI

Node proxies:

- upload PDF
- ask from PDF
- generate quiz from PDF

### FastAPI to ChromaDB

FastAPI stores and searches:

- chunked PDF text vectors

### FastAPI to Groq

FastAPI uses Groq for:

- answer generation
- quiz generation

---

## 18. Easy Mental Model

If you want to remember the project in one sentence:

StudySync uses Node/Express as the main app brain, MongoDB as permanent storage, Socket.IO for live room activity, and FastAPI RAG for PDF-based AI features.

---

## 19. What To Say In An Interview

If someone asks how StudySync works, you can say:

1. Users authenticate with JWT cookies.
2. Groups are managed with a separate membership layer for RBAC.
3. Chat is realtime through a Socket.IO `/study` namespace.
4. Tasks, points, leaderboards, and profile analytics all use MongoDB.
5. AI features are isolated into a FastAPI service that handles PDF ingestion, retrieval, and Groq generation.
6. The frontend talks to Node only, and Node talks to MongoDB and FastAPI on the backend.

That is the clean story.

---

## 20. Final Note

This document reflects the current codebase, not the original plan.

If a feature is mentioned here, it should match what the project is doing today.
If something changes later, this file should be the first place we update.

