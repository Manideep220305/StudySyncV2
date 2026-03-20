StudySync 2.0 — Full Product Spec
One-Line Pitch
A real-time collaborative study platform where students form groups, chat live, compete on quizzes, and query their study material using AI.
Feature List (in priority order)
1. Auth + Identity
* Register / Login with JWT
* Passwords hashed with bcrypt
* Protected routes via `verifyToken` middleware
* httpOnly cookies for token storage (not localStorage — you already know this is a security issue from InsureVision)
2. Group Management with RBAC
* Create group → generates a 6-digit join code
* Join group via code
* Two roles: `leader` and `member`
* Leader-only actions: delete group, reset join code, kick members, trigger quiz
* Enforced via `requireRole('leader')` middleware on backend — not frontend
3. Membership Architecture (Junction Pattern)
* Separate `Memberships` collection, not an array inside Group
* Enables querying at scale without hitting MongoDB document limits
* Your biggest DB design talking point in interviews
4. Real-time Chat
* Socket.io with `/study` namespace
* Rooms scoped per `groupId`
* Typing indicators, live member count
* Messages persisted to MongoDB
5. Quiz Feature
* Leader triggers quiz from chat
* Backend fetches questions from QuizAPI
* Questions broadcast to entire room via Socket.io
* First correct answer logs a `PointEvent`
* Leaderboard updates in real-time
6. Gamified Leaderboard + Analytics
* Every quiz win, Pomodoro completion, task resolved = one `PointEvent` document
* MongoDB aggregation pipeline for leaderboard (global + per group)
* Recharts dashboard: activity line chart, individual vs group average
* Faker.js seed script: 50 users, 10 groups, 500 messages, point history
7. RAG — PDF Q&A (FastAPI microservice)
* User uploads PDF to a study group
* FastAPI service chunks it, embeds using Gemini embedding model, stores in ChromaDB
* Group members ask questions in a dedicated "Ask Notes" UI
* Node backend proxies the query to FastAPI, returns Gemini's answer
* Simple, free, defensible
What This Project Proves to Interviewers
ConceptWhere it showsDB design beyond basic CRUDJunction/Membership patternSecurity awarenesshttpOnly cookies, RBAC middlewareReal-time systemsSocket.io namespaces + roomsMongoDB aggregationLeaderboard pipelineExternal API integrationQuizAPI + GeminiAI/RAG buzzword with substanceFastAPI + ChromaDB + Gemini embeddingsScale simulationFaker.js seeding
What's Intentionally Left Out
* OCR (not defensible enough for the complexity)
* Redis (no justified use case in StudySync)
* File sharing beyond PDFs (scope creep)
* Mobile responsiveness (not your focus)
Tech Stack
LayerTechnologyFrontendReact, Tailwind, RechartsBackendNode.js, ExpressDatabaseMongoDBReal-timeSocket.ioAuthJWT + bcrypt + httpOnly cookiesStorageCloudinary + MulterQuizQuizAPIAI/RAGFastAPI + ChromaDB + GeminiSeedingFaker.jsDeploymentRender (Node) + Railway/Render (FastAPI)
Build Order (your 4 days)
Day 1 (Thursday)
* Schemas: User, Group, Membership
* Auth routes: register, login, logout
* Group routes: create, join, get members
* RBAC middleware
Day 2 (Friday)
* Socket.io setup: namespace, rooms, chat persistence
* Typing indicators, member count
* Basic chat UI
Day 3 (Saturday)
* QuizAPI integration
* Quiz broadcast via Socket.io
* PointEvent logging
* Aggregation pipeline for leaderboard
* Recharts dashboard
Day 4 (Sunday)
* FastAPI RAG service
* PDF upload → chunk → embed → ChromaDB
* Query endpoint wired to Node backend
* Faker.js seed script
* Deploy