import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { saveUserNotification } from '../lib/parkingApi';

const NotificationContext = createContext(null);

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}

/**
 * Notification types:
 *  'warning' — user overstayed after exit validation
 *  'fine'    — ₹10 fine applied for next booking
 *  'info'    — general informational message
 */
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const storageKey = user?.id ? `easypark_notifications_${user.id}` : null;

  // Load persisted notifications for current user
  useEffect(() => {
    if (!storageKey) {
      setNotifications([]);
      return;
    }
    try {
      const stored = localStorage.getItem(storageKey);
      setNotifications(stored ? JSON.parse(stored) : []);
    } catch {
      setNotifications([]);
    }
  }, [storageKey]);

  // Persist whenever notifications change
  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(notifications));
  }, [notifications, storageKey]);

  /**
   * Add a new read-only notification.
   * Persists to localStorage immediately and to Supabase asynchronously.
   */
  const addNotification = useCallback((type, title, message) => {
    const newNote = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,   // 'warning' | 'fine' | 'info'
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newNote, ...prev]);

    // Fire-and-forget backend save (silently fails if table doesn't exist)
    if (user?.id) {
      void saveUserNotification({ userId: user.id, type, title, message });
    }
  }, [user?.id]);

  /** Mark a single notification as read */
  const markRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  /** Mark all notifications as read */
  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = {
    notifications,
    unreadCount,
    addNotification,
    markRead,
    markAllRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
