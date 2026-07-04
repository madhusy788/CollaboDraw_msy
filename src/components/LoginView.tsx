import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { LogIn, User, Lock, Paintbrush, ArrowRight } from 'lucide-react';

interface LoginViewProps {
  onNavigateToRegister: () => void;
  onLoginSuccess: () => void;
}

export default function LoginView({ onNavigateToRegister, onLoginSuccess }: LoginViewProps) {
  const { login } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await login(usernameOrEmail, password);
      onLoginSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-100 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden px-4 py-12">
      
      {/* Dynamic Background Shapes (Whiteboard sketches drifting) */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Sketch Circle */}
        <motion.div
          initial={{ opacity: 0.1, x: -100, y: -100, rotate: 0 }}
          animate={{ opacity: 0.25, x: 200, y: 150, rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          className="absolute w-72 h-72 rounded-full border-4 border-dashed border-blue-400 dark:border-blue-600"
        />
        {/* Sketch Square */}
        <motion.div
          initial={{ opacity: 0.05, x: 800, y: 600, rotate: 45 }}
          animate={{ opacity: 0.2, x: 500, y: 300, rotate: 225 }}
          transition={{ duration: 30, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          className="absolute w-80 h-80 border-4 border-double border-indigo-400 dark:border-indigo-600 rounded-3xl"
        />
        {/* Arrow Vector sketch */}
        <motion.div
          initial={{ opacity: 0.08, x: 100, y: 500, scale: 0.8, rotate: -20 }}
          animate={{ opacity: 0.18, x: 300, y: 400, scale: 1.1, rotate: 10 }}
          transition={{ duration: 18, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          className="absolute flex items-center gap-2 text-indigo-500 dark:text-indigo-400"
        >
          <div className="w-48 h-1.5 bg-current rounded-full" />
          <div className="w-6 h-6 border-t-6 border-r-6 border-current rotate-45" />
        </motion.div>
        {/* Tiny grid overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-70" />
      </div>

      {/* LOGIN CONTAINER */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md z-10"
      >
        {/* Logo / Header */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-16 h-16 bg-blue-600 text-white flex items-center justify-center rounded-2xl shadow-xl shadow-blue-500/20 mb-3"
          >
            <Paintbrush className="w-8 h-8" />
          </motion.div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            CollabDraw
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Real-time collaborative vector workspace
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-800/50 shadow-2xl rounded-3xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Welcome Back</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Please log in to your account</p>
          </div>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 font-medium"
            >
              {errorMessage}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username/Email Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Username or Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="Enter username or email"
                  className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 text-slate-900 dark:text-white transition-colors placeholder-slate-400 dark:placeholder-slate-600"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 text-slate-900 dark:text-white transition-colors placeholder-slate-400 dark:placeholder-slate-600"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-blue-600/50 disabled:to-indigo-600/50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-2xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <LogIn className="w-4.5 h-4.5" />
                </>
              )}
            </button>
          </form>

          {/* Registration Trigger link */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <span className="text-xs text-slate-400 dark:text-slate-500">Don't have an account? </span>
            <button
              onClick={onNavigateToRegister}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Create Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
