import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginView from './components/LoginView';
import RegisterView from './components/RegisterView';
import DashboardView from './components/DashboardView';
import BoardView from './components/BoardView';

// Protected Route Guard Wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-500">Authenticating session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Wrapper to bridge react-router's route params with BoardView
function BoardRouteWrapper() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return <Navigate to="/" replace />;
  }

  return (
    <BoardView 
      boardId={id} 
      onBackToDashboard={() => navigate('/')} 
    />
  );
}

// Main App Router Handler
function AppContent() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-500">Booting CollabDraw Workspace...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* AUTHENTICATION ROUTES */}
      <Route 
        path="/login" 
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <LoginView 
              onNavigateToRegister={() => navigate('/register')} 
              onLoginSuccess={() => navigate('/')} 
            />
          )
        } 
      />
      
      <Route 
        path="/register" 
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <RegisterView 
              onNavigateToLogin={() => navigate('/login')} 
              onRegisterSuccess={() => navigate('/')} 
            />
          )
        } 
      />

      {/* SECURED WORKSPACE ROUTES */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <DashboardView onOpenBoard={(id) => navigate(`/board/${id}`)} />
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/board/:id" 
        element={
          <ProtectedRoute>
            <BoardRouteWrapper />
          </ProtectedRoute>
        } 
      />

      {/* FALLBACK ROUTE */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
