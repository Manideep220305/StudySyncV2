import React, { useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import AuthModal from './components/authModal';
import { Toaster } from './components/ui/toaster';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage from './pages/ProfilePage';
import RoomsPage from './pages/RoomsPage';

function AppRoutes() {
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleOpenAuth = (view: 'login' | 'register') => {
    setAuthView(view);
    setIsAuthModalOpen(true);
  };

  const handleCloseAuth = () => setIsAuthModalOpen(false);

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage onOpenAuth={handleOpenAuth} />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <SocketProvider>
                <Dashboard />
              </SocketProvider>
            </ProtectedRoute>
          }
        />

        <Route
          path="/rooms"
          element={
            <ProtectedRoute>
              <SocketProvider>
                <RoomsPage />
              </SocketProvider>
            </ProtectedRoute>
          }
        />

        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <SocketProvider>
                <LeaderboardPage />
              </SocketProvider>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AuthModal isOpen={isAuthModalOpen} onClose={handleCloseAuth} initialView={authView} />
      <Toaster />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
