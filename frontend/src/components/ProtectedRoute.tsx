import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// --- ProtectedRoute ---
// This is a "route guard" component. It wraps any page that requires the user to be logged in.
// How it works:
//   1. If auth is still loading (we're checking the cookie on startup), show a spinner.
//   2. If the user is NOT authenticated after loading, redirect to "/" (the landing page).
//   3. If the user IS authenticated, render the protected page normally.
//
// Usage in App.tsx:
//   <ProtectedRoute>
//     <Dashboard />
//   </ProtectedRoute>
//
// TypeScript: { children: React.ReactNode } means this component accepts any valid JSX as children.
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  // While AuthContext is doing its initial "am I logged in?" API call,
  // show a loading spinner to prevent a flash of the redirect.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If the auth check is done and the user is not logged in,
  // redirect them to the home/landing page.
  // `replace` replaces the current history entry so the user can't click "back" to get here.
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // User is authenticated — render the children (e.g., <Dashboard />)
  return children;
}
