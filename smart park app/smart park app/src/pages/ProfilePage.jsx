import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import BottomNav from '../components/layout/BottomNav';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { formatCurrency, formatPhone } from '../utils/formatters';
import {
  User, Phone, Wallet, LogOut, MapPin,
  Clock, CreditCard, Star, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-navy-900 pb-24">
      <Navbar title="Profile" showBack={false} showWallet={false} />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4 animate-fade-in">
        {/* Profile header */}
        <div className="text-center py-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-electric-500 to-emerald-500 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">{user.name}</h2>
          <p className="text-white/40 text-sm flex items-center justify-center gap-1 mt-1">
            <Phone className="w-3 h-3" />
            +91 {formatPhone(user.phone)}
          </p>
        </div>

        {/* Wallet */}
        <Card className="!bg-gradient-to-r from-electric-500/10 to-emerald-500/10 border-electric-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-white/40">Wallet Balance</p>
                <p className="text-xl font-bold text-emerald-400">
                  {formatCurrency(user.walletBalance)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Menu items */}
        <div className="space-y-1">
          {[
            { icon: Clock, label: 'Booking History', path: '/history' },
            { icon: MapPin, label: 'My Parking Slots', path: '/register-slot' },
          ].map(({ icon: Icon, label, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-white/5 transition-colors"
            >
              <Icon className="w-5 h-5 text-white/40" />
              <span className="text-sm text-white flex-1 text-left">{label}</span>
              <ChevronRight className="w-4 h-4 text-white/20" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <div className="pt-4">
          <Button fullWidth variant="danger" icon={LogOut} onClick={handleLogout}>
            Log Out
          </Button>
        </div>

        {/* App info */}
        <div className="text-center py-4">
          <p className="text-white/20 text-xs">Easy Park v1.0.0</p>
          <p className="text-white/10 text-[10px] mt-1">Smart Peer-to-Peer Parking</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
