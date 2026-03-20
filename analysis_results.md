# StudySync2 Application Analysis

This document provides a comprehensive analysis of the StudySync2 application, a gamified, collaborative web application for student study groups.

## 1. Project Overview

StudySync2 is a full-stack MERN (MongoDB, Express, React, Node.js) application designed to help students track their progress on tasks and stay motivated through a points-based system. It features real-time chat, group focus timers, and competitive leaderboards.

## 2. Backend Analysis

The backend is built with Node.js and Express, using Mongoose to interact with a MongoDB database.

### 2.1. Database Schema

The data is structured into the following Mongoose models:

*   **User:** Stores user information, including username, email, encrypted password, and total points.
*   **Group:** Represents a study group with a name, description, join code, and creator.
*   **Membership:** A join table that links users to groups, defining their role (leader or member).
*   **Message:** Stores messages sent within a group, which can be text, system messages, or quizzes.
*   **PointEvent:** Records instances of users earning points for various activities.
*   **Task:** Represents a user's to-do item with a title, completion status, and XP value.

### 2.2. API Endpoints

The backend exposes a RESTful API for managing users, groups, tasks, and other resources.

*   **/api/auth**: Handles user registration, login, logout, and fetching the current user's profile.
*   **/api/groups**: Manages study groups, including creation, retrieval, joining, and deletion.
*   **/api/groups/:groupId/members**: Manages group members, including listing and kicking members.
*   **/api/tasks**: Provides CRUD (Create, Read, Update, Delete) operations for user tasks.

### 2.3. Authentication and Authorization

*   Authentication is handled using JSON Web Tokens (JWTs) stored in secure `httpOnly` cookies.
*   The `protect` middleware is used to secure routes that require authentication.
*   The `requireRole` middleware provides role-based access control, restricting certain actions to group leaders.

## 3. Frontend Analysis

The frontend is a single-page application built with React, Vite, and TypeScript. It uses Tailwind CSS for styling and various libraries for UI components and animations.

### 3.1. Key Components and Pages

*   **LandingPage.tsx**: The public-facing marketing page.
*   **Dashboard.tsx**: The main dashboard for authenticated users.
*   **authModal.tsx**: A modal for user login and registration.
*   **Questlog.tsx**: A gamified to-do list widget on the dashboard.
*   **ProtectedRoute.tsx**: A route guard that protects authenticated routes.
*   **SidebarLayout.tsx**: A layout component that provides a consistent sidebar for navigation.

### 3.2. Frontend Services and State Management

*   **AuthContext.tsx**: Manages the application's authentication state, providing user information and login/logout functions to the entire app.
*   **taskService.ts**: A dedicated service for making API calls to the backend's task-related endpoints.

## 4. Overall Architecture

StudySync2 follows a classic client-server architecture:

*   The **React frontend** is responsible for rendering the user interface and managing client-side state.
*   The **Node.js/Express backend** provides a RESTful API for data persistence and business logic.
*   The frontend and backend communicate via HTTP requests, with authentication handled by JWTs in cookies.

This separation of concerns allows for independent development and deployment of the frontend and backend.
