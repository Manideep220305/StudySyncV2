# StudySync Frontend Documentation

## 1. Scope

This document covers only the frontend application inside frontend/src.

It includes:
- architecture (pages, components, hooks, context, services)
- frontend-backend interaction (REST + Socket.IO)
- state management flow
- implemented features
- missing/improvable parts

---

## 2. Frontend Architecture Overview

### 2.1 Stack and runtime model

- Framework: React + TypeScript
- Build tool: Vite
- Routing: react-router-dom
- Networking: axios (cookie-based auth)
- Realtime: socket.io-client
- UI primitives: shadcn-style components + custom UI components
- Animation: framer-motion

The frontend follows a modular feature-oriented layout:
- pages: route-level screens
- components: reusable UI and feature widgets
- context: app-wide providers (auth, socket)
- services: API clients by domain
- hooks: shared behavior utilities

### 2.2 App shell composition

Boot path:
1. main.tsx renders App.
2. App wraps the app with AuthProvider and Router.
3. AppRoutes mounts public and protected routes.
4. Protected routes are guarded by ProtectedRoute.
5. Route-level pages compose feature components.

### 2.3 Route map

Public route:
- / -> LandingPage

Protected routes:
- /dashboard -> Dashboard (+ SocketProvider)
- /rooms -> RoomsPage (+ SocketProvider)
- /leaderboard -> LeaderboardPage (+ SocketProvider)
- /profile -> ProfilePage

Fallback:
- * -> Navigate to /

### 2.4 Component layers

Layer 1: App shell
- App, AppRoutes, ProtectedRoute

Layer 2: layout/navigation
- SidebarLayout
- Navbar, Footer (landing only)

Layer 3: feature components
- GroupChat
- QuizPanel
- FocusTimer
- QuestLog
- AuthModal

Layer 4: UI primitives
- button, toast/toaster, card-like wrappers, animated background helpers

---

## 3. Folder Structure (Frontend Core)

### 3.1 Core entry and app shell

- src/main.tsx
  - React root bootstrap.

- src/App.tsx
  - Route graph, modal host, provider wiring.

### 3.2 Context providers

- src/context/AuthContext.tsx
  - Auth session lifecycle and API auth methods.

- src/context/SocketContext.tsx
  - Socket creation, connection state, reconnect event handling.

### 3.3 Pages

- src/pages/LandingPage.tsx
- src/pages/Dashboard.tsx
- src/pages/RoomsPage.tsx
- src/pages/LeaderboardPage.tsx
- src/pages/ProfilePage.tsx

### 3.4 Services (backend gateway)

- src/services/groupService.ts
- src/services/taskService.ts
- src/services/quizService.ts
- src/services/pointsService.ts
- src/services/leaderboardService.ts
- src/services/profileService.ts

---

## 4. Architecture by Concern

### 4.1 Pages and responsibilities

LandingPage:
- Marketing/public entry.
- Opens auth modal through onOpenAuth callback.

Dashboard:
- User overview panel.
- Fetches profile + tasks and derives KPI widgets.
- Integrates FocusTimer and QuestLog.
- Supports create/join group modals.

RoomsPage:
- Collaboration hub.
- Left rail for group selection.
- Center panel GroupChat (chat + quiz tab).
- Right panel focus timer, active quests, group goals.
- Info drawer for members and group actions.

LeaderboardPage:
- Global and group leaderboard tables.
- Live refresh using socket events.

ProfilePage:
- Personal stats and recent activity timeline.
- Uses profile and points breakdown APIs.

### 4.2 Context responsibilities

AuthContext:
- Holds user, loading, error, isAuthenticated.
- Performs startup session check via /api/auth/me.
- Exposes register/login/logout methods.
- Uses withCredentials for cookie-based auth.

SocketContext:
- Creates socket connection to /study namespace.
- Tracks isConnected status.
- Provides socket instance to descendants.
- Configures credentialed handshake for JWT cookie auth.

### 4.3 Hooks and local state patterns

use-toast:
- App-wide ephemeral notifications.
- Reducer + listener registry pattern.
- Used heavily for non-blocking success/error UX.

Page-level local state:
- Large useState + useMemo + useEffect orchestration in Dashboard and Rooms.
- Derived states used for metrics, filtering, progress indicators, and modal workflows.

### 4.4 Service layer pattern

Each service file:
- wraps domain-specific endpoints
- centralizes axios usage
- always sends credentials
- exports typed request/response contracts

This separates network details from UI components and keeps page logic readable.
---

## 5. UI Interaction with Backend (REST APIs)

### 5.1 Authentication flow from UI

AuthModal -> AuthContext:
- register(email/password/username)
- login(email/password)
- logout()

AuthContext backend calls:
- GET /api/auth/me
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout

ProtectedRoute then gates private pages using isAuthenticated + loading.

### 5.2 Group and member flows

groupService endpoints used by Dashboard/Rooms/Leaderboard:
- POST /api/groups
- GET /api/groups
- GET /api/groups/public
- GET /api/groups/:groupId
- POST /api/groups/join
- GET /api/groups/:groupId/members
- DELETE /api/groups/:groupId/members/:userId
- PATCH /api/groups/:groupId/members/:userId

UX behaviors:
- create/join modals update local group list
- member actions use confirm modal and refresh list/members
- selected group drives chat, info panel, leaderboard scope

### 5.3 Task and points flows

taskService:
- GET /api/tasks
- POST /api/tasks
- PUT /api/tasks/:id
- DELETE /api/tasks/:id

pointsService:
- POST /api/points/pomodoro
- POST /api/points/quiz-correct
- POST /api/points/quiz-attempt

Used for:
- quest updates
- pomodoro completion XP sync
- quiz analytics and scoring records

### 5.4 Quiz and analytics flows

quizService:
- POST /api/groups/:groupId/quiz/start
- GET /api/groups/:groupId/quiz/current
- POST /api/groups/:groupId/quiz/answer

profileService:
- GET /api/profile/me
- GET /api/profile/accuracy

leaderboardService:
- GET /api/leaderboard/global
- GET /api/leaderboard/group/:groupId

---

## 6. UI Interaction with Backend (Socket.IO)

### 6.1 Connection model

SocketContext opens:
- io("http://localhost:5000/study", { withCredentials: true, autoConnect: false })

Connection events handled:
- connect
- disconnect
- connect_error
- reconnect_failed

### 6.2 Chat event contract

GroupChat emits:
- join-group { joinCode }
- send-message { text, files }
- typing { isTyping }

GroupChat listens:
- message-history
- new-message
- typing
- chat-error

### 6.3 Quiz realtime contract

QuizPanel listens:
- quiz-started
- quiz-answer-result
- quiz-finished

LeaderboardPage listens:
- leaderboard-updated
- quiz-finished

LeaderboardPage also emits join-group for selected room to receive room-scoped updates.

---

## 7. State Management Flow

### 7.1 Global state

Auth state:
- owner: AuthContext
- consumers: ProtectedRoute, Navbar, SidebarLayout, pages
- transitions:
  - app startup -> check /me -> set user or null
  - login/register success -> set user
  - logout -> clear user

Socket state:
- owner: SocketContext
- consumers: GroupChat, QuizPanel, LeaderboardPage
- transitions:
  - mount -> connect
  - disconnect/reconnect updates isConnected

### 7.2 Feature-level state

Dashboard:
- source state: profile, tasks, accuracyTopics
- derived state: stat cards, trend cards, today metrics
- side effects: load profile/tasks, optional accuracy fetch, pomodoro XP sync

RoomsPage:
- source state: groups, selectedGroup, tasks, goals, members, timer states, modal/confirm states
- side effects:
  - initial fetch groups/tasks
  - fetch members on info panel open
  - timer interval and phase switching

GroupChat:
- source state: messages, typing users, pending files, active tab
- side effects: socket subscriptions tied to groupCode

QuizPanel:
- source state: activeQuiz, selected answer, answered set, summary, status text
- side effects: load current quiz per group + socket sync events

LeaderboardPage:
- source state: global rows, group rows, selected group, live update timestamp
- side effects: REST load + socket-triggered refresh

### 7.3 State update style patterns

Patterns in use:
- optimistic updates (tasks, member actions)
- defensive normalization of API payload shapes
- derived memoized values for expensive UI calculations
- controlled forms for auth/group creation/join
- event-driven refresh on realtime notifications

---

## 8. Key Features Implemented

1. Route-protected authenticated app shell with cookie-based session continuity.
2. Full auth modal flow (register/login/logout) integrated with context.
3. Group collaboration UI with create/join/select and member management actions.
4. Live room chat with typing indicators and history replay.
5. Room quiz lifecycle: start, answer, finish, summary, realtime propagation.
6. Dashboard insights powered by profile, tasks, and accuracy analytics.
7. Focus timer + XP logging integration through points API.
8. Quest/task management with inline edit, toggle, delete, and progress visuals.
9. Global + group leaderboards with live refresh from socket events.
10. Profile page with XP breakdown and recent activity timeline.
---

## 9. Missing or Improvable Parts

### 9.1 Configuration and environment

- API and socket URLs are hardcoded to localhost.
- Should move to Vite environment variables for dev/staging/prod parity.

### 9.2 API contract consistency

- UI handles multiple response shapes (for example group join).
- Standardized backend response schema would reduce frontend branching.

### 9.3 Service-route mismatch risk

- groupService includes getMessages REST path (/groups/:id/messages), but backend currently relies on socket history event and does not expose this REST route in mounted backend routes.
- This function is currently a dead/incompatible integration path.

### 9.4 Realtime robustness

- No explicit reconnect replay strategy for missed room events.
- No local queue/retry strategy for chat sends during transient disconnect.

### 9.5 State complexity

- RoomsPage and Dashboard are large stateful components.
- Splitting into feature hooks (for example useRoomsData/useDashboardMetrics) would reduce coupling and improve testability.

### 9.6 Error and loading UX standardization

- Error messages are mostly toast-driven and non-uniform.
- A centralized API error mapper would improve consistency.

### 9.7 Feature completeness gaps

- File sharing is a placeholder in rooms info panel.
- GroupChat file attachments have TODO for Cloudinary upload path.

### 9.8 Data persistence choices

- Some room goals/timer states are local-only and reset on refresh.
- Persisting shared goals or timer sessions would align better with collaborative intent.

### 9.9 Testing coverage

- No visible unit/integration test suite in frontend folder for core flows.
- Critical flows to prioritize: auth bootstrap, protected routing, room socket events, optimistic task updates.

---

## 10. Summary

The frontend is a well-structured v1 collaboration client with:
- clear provider-based architecture
- domain service layer for backend access
- realtime room interactions via Socket.IO
- strong feature breadth across auth, chat, quiz, tasks, analytics, and leaderboard

Primary next step is production hardening: environment-driven config, tighter API contracts, state decomposition in heavy pages, and stronger realtime/test reliability.
