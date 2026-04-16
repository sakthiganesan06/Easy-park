import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Clock, PlusSquare, User, MapPin } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/history', label: 'History', icon: Clock },
  { path: '/register-slot', label: 'Register', icon: PlusSquare },
  { path: '/profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on certain pages
  const hiddenPaths = ['/login', '/lock', '/payment', '/session'];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-navy-800/95 backdrop-blur-xl border-t border-white/10 z-[1300] px-2 pb-safe">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-1 py-3 px-4 transition-all duration-200 ${
                isActive
                  ? 'text-electric-400'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <div className={`relative ${isActive ? '' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-lg' : ''}`} />
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-electric-400 rounded-full" />
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
