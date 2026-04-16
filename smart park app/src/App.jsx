import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import { BookingProvider } from './contexts/BookingContext';
import { NotificationProvider } from './contexts/NotificationContext';

import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import SlotDetailPage from './pages/SlotDetailPage';
import BookingPage from './pages/BookingPage';
import LockPage from './pages/LockPage';
import PaymentPage from './pages/PaymentPage';
import ActiveSessionPage from './pages/ActiveSessionPage';
import RegisterSlotPage from './pages/RegisterSlotPage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  return children;
}

// Public route (redirect to home if already logged in)
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/slot/:slotId"
        element={
          <ProtectedRoute>
            <SlotDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/book/:slotId"
        element={
          <ProtectedRoute>
            <BookingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lock"
        element={
          <ProtectedRoute>
            <LockPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment"
        element={
          <ProtectedRoute>
            <PaymentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session"
        element={
          <ProtectedRoute>
            <ActiveSessionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/register-slot"
        element={
          <ProtectedRoute>
            <RegisterSlotPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <HistoryPage />
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
      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <LocationProvider>
            <BookingProvider>
              <div className="font-sans">
                <AppRoutes />
                <Toaster
                  position="top-center"
                  toastOptions={{
                    duration: 3000,
                    style: {
                      background: '#1e293b',
                      color: '#e2e8f0',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      padding: '12px 16px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    },
                    success: {
                      iconTheme: {
                        primary: '#10b981',
                        secondary: '#1e293b',
                      },
                    },
                    error: {
                      iconTheme: {
                        primary: '#f43f5e',
                        secondary: '#1e293b',
                      },
                    },
                  }}
                />
              </div>
            </BookingProvider>
          </LocationProvider>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}
