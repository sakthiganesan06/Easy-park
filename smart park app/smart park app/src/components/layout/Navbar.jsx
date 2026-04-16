import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MapPin, Wallet, LogOut, ChevronLeft } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export default function Navbar({ title, showBack = false, showWallet = true }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-navy-900/90 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        {/* Left */}
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
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
        </div>
      </div>
    </header>
  );
}
