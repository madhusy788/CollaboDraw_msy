import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api, getToken, removeToken } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (usernameOrEmail: string, passwordPlain: string) => Promise<void>;
  register: (fullName: string, username: string, email: string, passwordPlain: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user profile on mount (persistent session reload)
  useEffect(() => {
    async function loadUser() {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.getProfile();
        setUser(data.user);
      } catch (err) {
        console.error('Failed to restore session:', err);
        removeToken();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (usernameOrEmail: string, passwordPlain: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.login(usernameOrEmail, passwordPlain);
      setUser(data.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (fullName: string, username: string, email: string, passwordPlain: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.register(fullName, username, email, passwordPlain);
      setUser(data.user);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    removeToken();
    setUser(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
