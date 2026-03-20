# StudySync Project Overview

This document is the short, readable summary of the whole project.

It explains:

- what the app does
- what each page is for
- what features are already done
- what is still left
- how the main pieces connect together

This is meant to be the easiest document to read if you want the big picture fast.

---

## 1. What StudySync Is

StudySync is a collaborative study platform.

It combines:

- group study rooms
- realtime chat
- quizzes
- pomodoro/focus tracking
- tasks and progress tracking
- points and leaderboard
- profile analytics
- AI notes and quiz generation from PDFs

The idea is simple:

users join study groups, chat live, upload notes, ask questions from those notes, and compete in quizzes while earning points.

---

## 2. Main Tech Stack

### Frontend

- React
- TypeScript
- React Router
- Socket.IO client

### Backend

- Node.js
- Express
- Socket.IO
- MongoDB with Mongoose

### AI service

- FastAPI
- Groq
- ChromaDB in memory
- sentence-transformers
- PyMuPDF

---

## 3. Big Architecture

```text
React Frontend
    -> Node/Express backend
    -> MongoDB

React Frontend
    -> Socket.IO /study namespace
    -> Node realtime chat and quiz events

Node/Express backend
    -> FastAPI RAG service
    -> ChromaDB in memory
    -> Groq model
```

The frontend never talks directly to MongoDB or FastAPI.

It goes through Node first.

That is the main design choice of the project.

---

## 4. Pages in the App

The app currently has these main pages:

- Landing Page
- Dashboard
- Rooms Page
- Leaderboard Page
- Profile Page

Each one has a different job.

---

## 5. Landing Page

File:

- `frontend/src/pages/LandingPage.tsx`

### What it does

This is the public entry page.

It usually shows:

- intro text
- app branding
- login/register entry points

### Why it matters

It is the first thing a new user sees.

It is the gateway into the authenticated part of the app.

### Done status

- done

---

## 6. Dashboard Page

File:

- `frontend/src/pages/Dashboard.tsx`

### What it does

The dashboard is the main home page after login.

It is where users usually see:

- their groups
- tasks
- focus timer
- points/progress
- quick access to the study workspace

### What it connects to

- groups API
- tasks API
- profile/points data
- leaderboard data

### Done status

- done

---

## 7. Rooms Page

File:

- `frontend/src/pages/RoomsPage.tsx`

### What it does

This is the study room workspace.

It is the page where users:

- enter a group room
- chat live
- see group info
- manage members if they are leader
- access quiz
- view goals and side widgets

### Main areas inside it

- left group rail
- center chat / quiz area
- right utility sidebar

### What it connects to

- group list API
- member API
- socket chat events
- quiz events
- group file metadata

### Done status

- done

---

## 8. Leaderboard Page

File:

- `frontend/src/pages/LeaderboardPage.tsx`

### What it does

This page shows ranked users based on points.

It usually has:

- global leaderboard
- group leaderboard
- ranking updates

### What it connects to

- leaderboard API
- realtime leaderboard updates from quiz events

### Done status

- done

---

## 9. Profile Page

File:

- `frontend/src/pages/ProfilePage.tsx`

### What it does

This page shows personal analytics for the logged-in user.

It can show things like:

- total points
- recent activity
- rank
- accuracy trends

### What it connects to

- profile API
- accuracy API

### Done status

- done

---

## 10. Core Frontend Components

These components do most of the work inside the pages.

### AuthModal

File:

- `frontend/src/components/authModal.tsx`

Handles login and registration UI.

### Navbar

File:

- `frontend/src/components/Navbar.tsx`

Top navigation and entry controls.

### SidebarLayout

File:

- `frontend/src/components/SidebarLayout.tsx`

Main app shell for sidebar-based layouts.

### GroupCard

File:

- `frontend/src/components/GroupCard.tsx`

Displays a group summary card.

### GroupChat

File:

- `frontend/src/components/GroupChat.tsx`

Realtime chat, typing, file upload, AI ask notes.

### QuizPanel

File:

- `frontend/src/components/QuizPanel.tsx`

Live quiz UI, AI quiz generation, scorecard, quiz end controls.

### FocusTimer

File:

- `frontend/src/components/FocusTimer.tsx`

Pomodoro/focus timer UI.

### ProtectedRoute

File:

- `frontend/src/components/ProtectedRoute.tsx`

Blocks pages unless the user is logged in.

### Done status

These core components are mostly done.

The main remaining work here is polish and edge-case cleanup, not core structure.

---

## 11. Main Frontend Contexts

### AuthContext

File:

- `frontend/src/context/AuthContext.tsx`

This handles:

- login
- register
- logout
- session restore on refresh

It is the global auth state for the app.

### SocketContext

File:

- `frontend/src/context/SocketContext.tsx`

This handles:

- Socket.IO connection
- connect/disconnect state
- cookie-authenticated socket session

### Done status

- done

---

## 12. Main Frontend Services

These are the small HTTP wrappers that call backend routes.

### Group service

- `frontend/src/services/groupService.ts`

Used for:

- create group
- list groups
- join group
- get group members
- kick/promote members
- read and save file names

### Quiz service

- `frontend/src/services/quizService.ts`

Used for:

- start quiz
- get current quiz
- submit answer
- end quiz

### AI service

- `frontend/src/services/aiService.ts`

Used for:

- upload PDF
- ask question from PDF
- generate AI quiz
- check AI health

### Points service

- `frontend/src/services/pointsService.ts`

Used for:

- pomodoro points
- quiz correctness points
- quiz attempt tracking

### Leaderboard service

- `frontend/src/services/leaderboardService.ts`

Used for:

- global leaderboard
- group leaderboard

### Profile service

- `frontend/src/services/profileService.ts`

Used for:

- profile summary
- accuracy analytics

### Done status

- done

---

## 13. Backend Overview

The Node backend is the main application backend.

It does the important trusted work:

- authentication
- role checks
- validation
- database access
- realtime room coordination
- AI proxying
- leaderboard and points logic

### Main backend folders

- `backend/routes`
- `backend/controllers`
- `backend/services`
- `backend/models`
- `backend/middleware`

### Done status

- done

---

## 14. Backend Route Groups

### Auth

- register
- login
- logout
- get current user

### Groups

- create groups
- join groups
- list my groups
- get group details
- save file names
- manage join code

### Members

- list members
- kick member
- promote member

### Chat / socket support

- realtime message persistence
- room join history

### Quiz

- start quiz
- answer quiz
- current quiz
- end quiz

### Points

- pomodoro
- quiz correctness
- quiz attempt analytics

### Leaderboard

- global ranking
- group ranking

### Profile

- profile summary
- accuracy trends

### AI

- upload PDF
- ask from PDF
- generate AI quiz
- AI health check

---

## 15. Database Structure

MongoDB stores the permanent application data.

### Collections

- `users`
- `groups`
- `memberships`
- `messages`
- `tasks`
- `pointevents`
- `quizattempts`

### What each one means

- `users`: login identity, profile, total points
- `groups`: group details, join code, file metadata
- `memberships`: who belongs to which group and with what role
- `messages`: chat history
- `tasks`: task items
- `pointevents`: all XP changes
- `quizattempts`: quiz accuracy analytics

### Done status

- done

---

## 16. Socket / Realtime Features

Socket.IO is used for:

- live chat
- typing indicators
- quiz events
- score updates
- room updates

### Socket namespace

- `/study`

### What the socket does

When a user joins a room:

- the backend checks their cookie JWT
- the backend checks membership
- the socket joins the group room
- the newest message history is sent

### Important realtime events

- `join-group`
- `message-history`
- `new-message`
- `typing`
- `quiz-started`
- `quiz-answer-result`
- `quiz-finished`
- `leaderboard-updated`

### Done status

- done

---

## 17. AI / FastAPI Features

This is the current AI side of the app.

It is separate from Node, but Node controls access to it.

### FastAPI does

- PDF upload
- PDF text extraction
- chunking
- embeddings
- storing vectors in ChromaDB
- answer generation
- quiz generation

### Current AI model setup

- local embeddings: `all-MiniLM-L6-v2`
- generation model: Groq `llama-3.1-8b-instant`

### AI endpoints

- `/upload-pdf`
- `/ask`
- `/generate-quiz`
- `/health`

### Done status

- done for the current implementation
- still limited by in-memory storage

---

## 18. Feature Status Tracker

This is the blunt summary of what is done and what is still left.

### Fully done

- authentication
- session restore
- group creation and join flow
- group RBAC with memberships
- member list / kick / promote
- realtime chat
- task CRUD
- points system
- global and group leaderboards
- profile analytics
- AI PDF upload
- AI ask from PDF
- AI quiz generation
- live quiz integration
- scorecard / end quiz flow

### Mostly done but still has rough edges

- UI polish in some layouts
- better empty states and loading states
- more robust error handling in a few screens
- stronger persistence for AI vectors
- more test coverage

### Still left

- persistent storage for FastAPI vectors if you want PDFs to survive restarts
- final UI polish across the app
- more automated testing
- deployment hardening
- docs cleanup and unification

---

## 19. What Is Temporary Right Now

These parts reset when the service restarts:

- active quiz sessions in Node memory
- PDF vectors in FastAPI ChromaDB memory

That means:

- if Node restarts, live quiz state is lost
- if FastAPI restarts, uploaded PDF context is lost

This is okay for the current demo setup, but it is the main technical limitation left.

---

## 20. Best Way To Explain the Project Simply

If someone asks, you can say:

StudySync is a study collaboration app where users join groups, chat in realtime, upload PDFs for AI help, generate quizzes from notes, track points, and monitor progress through a leaderboard and profile analytics.

Then add:

The frontend talks to a Node backend, Node stores data in MongoDB, and Node proxies AI requests to a FastAPI RAG service.

That is the clean summary.

---

## 21. Page-by-Page Status Summary

- Landing Page: done
- Dashboard: done
- Rooms Page: done
- Leaderboard Page: done
- Profile Page: done

### Main feature pages

- GroupChat: done
- QuizPanel: done
- AuthModal: done
- FocusTimer: done

### Core infrastructure

- AuthContext: done
- SocketContext: done
- backend routes: done
- FastAPI AI service: done

### Remaining work

- persistence improvements
- testing
- deployment polish
- final UI refinement

---

## 22. Final Project Status

The project is in a strong state.

The core product is already there.

What remains is mostly:

- persistence upgrades
- polish
- testing
- deployment hardening

If you want to keep one sentence in your head, keep this:

StudySync is built, usable, and connected end-to-end; the remaining work is mostly production hardening and cleaner persistence.

