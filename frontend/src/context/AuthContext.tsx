import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient, getApiErrorMessage, unwrapApiData } from '@/services/apiClient';

// --- TypeScript: Shape of a User object returned from the backend ---
// This mirrors the fields the backend sends back after login/register (see authController.js).
// Note: password is never included here — the backend strips it out.
interface User {
  _id: string;
  username: string;
  email: string;
  totalPoints?: number; // '?' means optional — present on the User model but might not be returned
  avatar?: string;
  role?: 'leader' | 'member'; // A user can be a leader in one group and a member in another
}

// --- TypeScript: Shape of everything this Context exposes to the app ---
// Any component that calls useAuth() will receive these exact fields and functions.
interface AuthContextType {
  user: User | null;            // The logged-in user, or null if not authenticated
  loading: boolean;             // True during the initial "am I logged in?" check
  error: string | null;         // Last auth error message, or null
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; data?: User; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; data?: User; error?: string }>;
  logout: () => Promise<{ success: boolean; error?: string }>;
  isAuthenticated: boolean;     // Convenience boolean — true if user is not null
}

// Create the Context with 'undefined' as default.
// The 'undefined' is intentional — our useAuth() hook will throw an error if
// someone tries to use the context outside of an <AuthProvider>.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- AuthProvider ---
// This component wraps the entire app (see App.tsx).
// It acts as the "global store" for the current user's authentication state.
// Any child component can access this state via the useAuth() hook.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start as `true` — we don't know the auth state yet
  const [error, setError] = useState<string | null>(null);

  // On first app load, check if the user is already logged in.
  // The backend reads the httpOnly JWT cookie and returns the user's data if it's valid.
  // This prevents the user from being logged out every time they refresh the page.
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await apiClient.get('/auth/me');
        setUser(unwrapApiData<User>(response.data)); // If successful, populate the user state
      } catch (err) {
        // If the cookie is missing or expired, the backend returns 401.
        // We silently fail — this just means the user is not logged in.
        setUser(null);
      } finally {
        setLoading(false); // Auth check is done, unblock the app from rendering
      }
    };
    checkAuth();
  }, []);

  // --- REGISTER ---
  // Sends registration data to the backend. On success, the backend:
  // 1. Creates the user in MongoDB
  // 2. Sets the httpOnly JWT cookie
  // 3. Returns the user object
  const register = async (username: string, email: string, password: string) => {
    setError(null);
    try {
      const response = await apiClient.post('/auth/register', {
        username,
        email,
        password,
      });
      const userPayload = unwrapApiData<User>(response.data);
      setUser(userPayload); // Update global user state
      return { success: true, data: userPayload };
    } catch (err: any) {
      const errorMessage = getApiErrorMessage(err, 'Registration failed');
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // --- LOGIN ---
  // Sends credentials to the backend. On success, backend validates password with bcrypt,
  // signs a JWT, and sets it as an httpOnly cookie.
  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
      });
      const userPayload = unwrapApiData<User>(response.data);
      setUser(userPayload);
      return { success: true, data: userPayload };
    } catch (err: any) {
      const errorMessage = getApiErrorMessage(err, 'Login failed');
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // --- LOGOUT ---
  // Calls the backend's /logout route, which clears the JWT cookie by overwriting it
  // with an empty, expired cookie. Then we clear the local user state.
  const logout = async () => {
    setError(null);
    try {
      await apiClient.post('/auth/logout');
      setUser(null); // Clear the user from global state — this logs them out of the UI
      return { success: true };
    } catch (err: any) {
      const errorMessage = 'Logout failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return (
    // Provide all state and functions to any child component that calls useAuth()
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      register,
      login,
      logout,
      isAuthenticated: !!user, // Convert user (object or null) to a boolean
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- useAuth hook ---
// This is the "consumer" of the AuthContext. Any component can call `const { user } = useAuth()`
// to access the logged-in user's data. The error thrown here is a developer safety net —
// it tells you immediately if you forgot to wrap your app in <AuthProvider>.
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
