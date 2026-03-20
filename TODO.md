# StudySync Groups + Chat Implementation TODO

## Phase 1: Backend Models (2 files) ✅
- [x] backend/models/Group.js: Add joinCode generation logic + index
- [x] backend/models/Message.js (NEW): Schema with indexes

## Phase 2: Backend Controllers (2 files) 
- [ ] backend/controllers/groupController.js: Full CRUD
- [ ] backend/controllers/memberController.js: Members + promote/kick

## Phase 3: Backend Socket.io ✅
- [x] backend/socket.js (NEW): Auth + chat events  
- [x] backend/server.js: httpServer + initSocket()

## Phase 4: Frontend Services/Context ✅
- [x] frontend/src/services/groupService.ts (NEW)
- [x] frontend/src/context/SocketContext.tsx (NEW)

## Phase 5: Frontend UI
- [x] frontend/src/components/GroupCard.tsx (NEW)
- [x] frontend/src/components/GroupChat.tsx (NEW)
- [ ] frontend/src/pages/Dashboard.tsx: Groups list/modal
- [ ] frontend/src/App.tsx: Wrap with SocketProvider

## Phase 6: Test
- [ ] Install socket.io-client (frontend) — Run: cd frontend && npm i socket.io-client
- [ ] Test full flow: Create → Join → Chat → Promote → Kick
- [ ] Seed test data

**Current: 0/18 complete**

