import { useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { MapPin, Wallet, ChevronLeft, Bell, AlertTriangle, BadgeDollarSign, Info, CheckCheck } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

/* ── icon per notification type ── */
function NotifIcon({ type }) {
  if (type === 'fine')    return <BadgeDollarSign className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />;
  if (type === 'warning') return <AlertTriangle    className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />;
  return                         <Info             className="w-4 h-4 text-blue-400  flex-shrink-0 mt-0.5" />;
}

/* ── relative time label ── */
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Notification Drawer ── */
function NotificationDrawer({ onClose }) {
  const { notifications, unreadCount, markAllRead } = useNotification();

  return (
    <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] flex flex-col rounded-2xl bg-[#0f172a] border border-white/10 shadow-2xl overflow-hidden z-[1400] animate-slide-down">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
        <p className="text-sm font-bold text-white">Notifications</p>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-[11px] text-electric-400 hover:text-electric-300 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 divide-y divide-white/5">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/30">
            <Bell className="w-8 h-8 opacity-30" />
            <p className="text-xs">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                n.read ? 'opacity-50' : 'bg-white/[0.03]'
              }`}
            >
              <NotifIcon type={n.type} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold leading-tight ${
                  n.type === 'fine' ? 'text-rose-300' :
                  n.type === 'warning' ? 'text-amber-300' : 'text-blue-300'
                }`}>
                  {n.title}
                </p>
                <p className="text-[11px] text-white/50 mt-0.5 leading-snug">{n.message}</p>
                <p className="text-[10px] text-white/25 mt-1">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.read && (
                <div className="w-1.5 h-1.5 rounded-full bg-electric-400 mt-1.5 flex-shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Navbar({ title, showBack = false, showWallet = true, onBack }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadCount } = useNotification();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);

  const handleBack = () => {
    if (typeof onBack === 'function') onBack();
    else navigate(-1);
  };

  // Close drawer on outside click
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [drawerOpen]);

  return (
    <header className="sticky top-0 z-[1300] bg-navy-900/90 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        {/* Left */}
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              type="button"
              onClick={handleBack}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5 text-white/70" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-electric-500 to-electric-700 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white text-lg tracking-tight">
                Easy<span className="text-electric-400">Park</span>
              </span>
            </div>
          )}
          {title && showBack && (
            <h1 className="text-white font-semibold text-base">{title}</h1>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {showWallet && user && (
            <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1.5 border border-white/10">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">
                {formatCurrency(user.walletBalance)}
              </span>
            </div>
          )}

          {/* Bell icon */}
          <div className="relative" ref={drawerRef}>
            <button
              type="button"
              id="navbar-bell-btn"
              onClick={() => setDrawerOpen((o) => !o)}
              className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/8"
              aria-label="Notifications"
            >
              <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-amber-400' : 'text-white/50'}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-rose-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-0.5 animate-bounce-in">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {drawerOpen && (
              <NotificationDrawer onClose={() => setDrawerOpen(false)} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
