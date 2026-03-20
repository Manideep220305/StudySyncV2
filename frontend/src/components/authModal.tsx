import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

// --- TypeScript: Define the shape of this component's props ---
// 'isOpen' controls visibility, 'onClose' is the callback to close the modal,
// 'initialView' lets the parent tell us whether to show 'login' or 'register' first.
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'login' | 'register';
}

// The AuthModal is a floating modal overlay that handles both Login and Register.
// It uses Framer Motion for smooth open/close animations and communicates with
// the backend via the AuthContext (login/register functions), NOT direct axios calls.
export default function AuthModal({ isOpen, onClose, initialView = 'login' }: AuthModalProps) {
  // isLogin = true  → show Login form
  // isLogin = false → show Register form
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Pull login/register functions from the global AuthContext
  const { login, register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Controlled form state — one object for all fields
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });

  // Sync the internal isLogin state whenever the parent changes `initialView` or re-opens the modal.
  // This allows LandingPage to open the modal directly on "Sign Up" or "Log In".
  useEffect(() => {
    if (isOpen) setIsLogin(initialView === 'login');
  }, [initialView, isOpen]);

  // Prevent background scroll when modal is open (accessibility + UX best practice)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Cleanup: always restore scroll when this component is unmounted
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Generic change handler for all form inputs.
  // Uses computed property [name] to update the correct field in formData.
  // TypeScript: React.ChangeEvent<HTMLInputElement> is the correct type for input onChange.
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handles form submission for both Login and Register.
  // Calls the context function which makes the API request and sets global user state.
  // TypeScript: React.FormEvent is the correct type for form onSubmit.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log('Form submitted:', { isLogin, formData });

    try {
      let result;
      if (isLogin) {
        console.log('Attempting login...');
        result = await login(formData.email, formData.password);
      } else {
        console.log('Attempting registration...');
        result = await register(formData.username, formData.email, formData.password);
      }

      console.log('Auth result:', result);

      if (result.success) {
        console.log('Success! User:', result.data);
        toast({
          title: "Success!",
          description: isLogin ? 'Logged in successfully' : 'Account created successfully',
        });
        // Reset form fields on success
        setFormData({ username: '', email: '', password: '' });
        // Small delay before closing so the user sees the success toast
        setTimeout(() => {
          onClose();
          navigate('/dashboard');
        }, 500);
      } else {
        console.log('Auth failed:', result.error);
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Auth exception:', error);
      toast({
        title: "Error",
        description: 'Something went wrong',
        variant: "destructive",
      });
    } finally {
      // Always re-enable the submit button, even on error
      setLoading(false);
    }
  };

  // Don't render anything to the DOM if the modal is closed
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">

        {/* 1. BACKDROP — clicking it closes the modal */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
        />

        {/* 2. MODAL WRAPPER — sits on top of the backdrop via z-[1000] */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative w-full max-w-[420px] z-[1000]"
        >
          {/* GLOW EFFECT — a blurred gradient div behind the modal creates a glowing border illusion */}
          <div className="absolute -inset-[3px] rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 opacity-75 blur-lg animate-pulse"></div>

          {/* GLASS CONTENT — the actual modal card sitting above the glow */}
          <div className="relative bg-[#0f172a] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden">

              {/* Close Button — top-right corner */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full z-10"
              >
                <X size={20} />
              </button>

              <div className="mt-2">
                {/* HEADER — changes text depending on login vs register mode */}
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white tracking-tight">
                    {isLogin ? 'Welcome Back' : 'Join the Squad'}
                  </h2>
                  <p className="text-slate-400 text-sm mt-2">
                    {isLogin ? 'Resume your focus streak.' : 'Start syncing your study sessions.'}
                  </p>
                </div>

                {/* TAB SWITCHER — toggles between Login and Sign Up views */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-xl mb-6 border border-white/5">
                  <button
                    onClick={() => setIsLogin(true)}
                    className={`py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${isLogin ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => setIsLogin(false)}
                    className={`py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${!isLogin ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Sign Up
                  </button>
                </div>

                {/* FORM — conditionally shows the username field only for registration */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Username field — only visible during registration */}
                    {!isLogin && (
                        <div className="relative group">
                           <User className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                           <input
                             type="text"
                             name="username"
                             placeholder="Username"
                             value={formData.username}
                             onChange={handleInputChange}
                             required
                             className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                           />
                        </div>
                    )}

                    {/* Email field */}
                    <div className="relative group">
                       <Mail className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                       <input
                         type="email"
                         name="email"
                         placeholder="Email address"
                         value={formData.email}
                         onChange={handleInputChange}
                         required
                         className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                       />
                    </div>

                    {/* Password field */}
                    <div className="relative group">
                       <Lock className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                       <input
                         type="password"
                         name="password"
                         placeholder="Password (min. 6 characters)"
                         value={formData.password}
                         onChange={handleInputChange}
                         required
                         minLength={6}
                         className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                       />
                    </div>

                    {/* SUBMIT BUTTON — disabled and dimmed while request is in-flight */}
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-8 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Loading...' : (isLogin ? 'Enter Room' : 'Create Account')}
                        {!loading && <ArrowRight className="ml-2 w-5 h-5" />}
                    </Button>
                </form>

                {/* Divider line (Google OAuth button is commented out below — left for future integration) */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                </div>
{/* 
                <button type="button" className="w-full h-12 bg-white text-slate-900 hover:bg-slate-200 rounded-xl text-sm font-bold flex items-center justify-center gap-3 transition-all">
                     <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                     </svg>
                     Google
                </button> */}
              </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}