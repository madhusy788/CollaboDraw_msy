import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { UserPlus, User, Mail, Lock, Paintbrush, ArrowLeft } from 'lucide-react';

interface RegisterViewProps {
  onNavigateToLogin: () => void;
  onRegisterSuccess: () => void;
}

export default function RegisterView({ onNavigateToLogin, onRegisterSuccess }: RegisterViewProps) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim() || !username.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      await register(fullName, username, email, password);
      onRegisterSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-100 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden px-4 py-12">
      
      {/* Background sketches */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0.1, x: -100, y: -100, rotate: 0 }}
          animate={{ opacity: 0.25, x: 200, y: 150, rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          className="absolute w-72 h-72 rounded-full border-4 border-dashed border-indigo-400 dark:border-indigo-600"
        />
        <motion.div
          initial={{ opacity: 0.05, x: 800, y: 600, rotate: 45 }}
          animate={{ opacity: 0.2, x: 500, y: 300, rotate: 225 }}
          transition={{ duration: 30, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          className="absolute w-80 h-80 border-4 border-double border-blue-400 dark:border-blue-600 rounded-3xl"
        />
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-70" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md z-10"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-indigo-600 text-white flex items-center justify-center rounded-2xl shadow-xl shadow-indigo-500/20 mb-3">
            <Paintbrush className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Join CollabDraw
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Draw, think, and design together in real time
          </p>
        </div>

        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-800/50 shadow-2xl rounded-3xl p-8">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 font-sans">Create an Account</h2>
          </div>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 font-medium"
            >
              {errorMessage}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Full Name */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white transition-colors"
                />
              </div>
            </div>

            {/* Username */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Username (must be unique)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="johndoe"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white transition-colors"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-indigo-600/50 disabled:to-blue-600/50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-lg active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Account</span>
                  <UserPlus className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <span className="text-xs text-slate-400 dark:text-slate-500">Already have an account? </span>
            <button
              onClick={onNavigateToLogin}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
