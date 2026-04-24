import React, { useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import ProtectedRoute from './components/ProtectedRoute';
import AuthModal from './components/authModal';
import Preloader from './components/ui/Preloader';
import { Toaster } from './components/ui/toaster';
import { AuthProvider } from './context/AuthContext';
import { AiStatusProvider } from './context/AiStatusContext';
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
              <AiStatusProvider>
                <SocketProvider>
                  <Dashboard />
                </SocketProvider>
              </AiStatusProvider>
            </ProtectedRoute>
          }
        />

        <Route
          path="/rooms"
          element={
            <ProtectedRoute>
              <AiStatusProvider>
                <SocketProvider>
                  <RoomsPage />
                </SocketProvider>
              </AiStatusProvider>
            </ProtectedRoute>
          }
        />

        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <AiStatusProvider>
                <SocketProvider>
                  <LeaderboardPage />
                </SocketProvider>
              </AiStatusProvider>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AiStatusProvider>
                <ProfilePage />
              </AiStatusProvider>
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
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading && <Preloader key="preloader" onComplete={() => setIsLoading(false)} />}
      </AnimatePresence>

      <div style={{ display: isLoading ? 'none' : 'block' }}>
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </div>
    </>
  );
}

export default App;
