import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import BottomNav from '../components/layout/BottomNav';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { formatCurrency, formatPhone } from '../utils/formatters';
import { getUserPenalties } from '../lib/parkingApi';
import {
  User, Phone, Wallet, LogOut, MapPin,
  Clock, ChevronRight, ShieldAlert, CheckCircle2,
  AlertTriangle, Loader2, BadgeDollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ── Penalty status badge ── */
function StatusBadge({ status }) {
  const isPaid = status === 'paid';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
      isPaid
        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
        : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
    }`}>
      {isPaid
        ? <><CheckCircle2 className="w-3 h-3" /> Paid</>
        : <><AlertTriangle className="w-3 h-3" /> Pending</>}
    </span>
  );
}

/* ── Penalty section ── */
function PenaltySection({ userId, pendingFine = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getUserPenalties(userId)
      .then(setData)
      .catch(() => setData({ records: [], totalPaid: 0, totalPending: 0 }))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 text-electric-400 animate-spin" />
      </div>
    );
  }

  const { records: dbRecords = [], totalPaid = 0, totalPending: dbPending = 0 } = data || {};

  // Merge the live uncharged fine (user.pendingFine) as a virtual pending entry
  const liveRecord = pendingFine > 0
    ? [{ id: '__live__', amount: pendingFine, status: 'pending', date: new Date().toISOString(), isLive: true }]
    : [];
  const records = [...liveRecord, ...dbRecords];

  const totalPending = dbPending + pendingFine;
  const totalEver    = totalPaid + totalPending;
  const totalCount   = records.length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center col-span-2">
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Total Penalties Till Date</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalEver)}</p>
          <p className="text-xs text-white/30 mt-0.5">
            Applied <span className="font-semibold text-white/60">{totalCount}</span> time{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="rounded-2xl bg-emerald-500/8 border border-emerald-500/20 p-3 text-center">
          <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider mb-1">Paid</p>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(totalPaid)}</p>
          <p className="text-[10px] text-emerald-400/40 mt-0.5">
            {records.filter(r => r.status === 'paid').length} incident{records.filter(r => r.status === 'paid').length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="rounded-2xl bg-rose-500/8 border border-rose-500/20 p-3 text-center">
          <p className="text-[10px] text-rose-400/60 uppercase tracking-wider mb-1">Pending</p>
          <p className="text-lg font-bold text-rose-400">{formatCurrency(totalPending)}</p>
          <p className="text-[10px] text-rose-400/40 mt-0.5">
            {records.filter(r => r.status === 'pending').length} incident{records.filter(r => r.status === 'pending').length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Records list */}
      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-white/30">
          <CheckCircle2 className="w-10 h-10 opacity-30" />
          <p className="text-sm">No penalties on record 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r, i) => (
            <div
              key={r.id || i}
              className={`flex items-center gap-3 p-4 rounded-2xl border ${
                r.status === 'paid'
                  ? 'bg-white/[0.03] border-white/8'
                  : r.isLive
                    ? 'bg-rose-500/8 border-rose-500/25 ring-1 ring-rose-500/20'
                    : 'bg-rose-500/5 border-rose-500/15'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                r.status === 'paid' ? 'bg-emerald-500/15' : 'bg-rose-500/15'
              }`}>
                <BadgeDollarSign className={`w-4 h-4 ${
                  r.status === 'paid' ? 'text-emerald-400' : 'text-rose-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">
                  {r.isLive ? 'Upcoming Fine — Next Booking' : `Overstay Fine — Incident ${i + 1}`}
                </p>
                <p className="text-xs text-electric-400/70 mt-0.5 font-medium">
                  50% of booking amount
                </p>
                {r.isLive ? (
                  <p className="text-xs text-rose-400/60 mt-0.5">
                    Will be charged on your next payment
                  </p>
                ) : (
                  <p className="text-xs text-white/35 mt-0.5">
                    {r.date ? new Date(r.date).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    }) : '—'}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-sm font-bold text-white">{formatCurrency(r.amount)}</span>
                <StatusBadge status={r.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPending > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-rose-300/80">
            You have <span className="font-bold">{formatCurrency(totalPending)}</span> in pending penalties.
            These will be charged automatically on your next booking payment.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Tab bar ── */
function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all duration-200 ${
        active
          ? 'bg-electric-500/20 text-electric-400 border border-electric-500/30'
          : 'text-white/40 hover:text-white/60'
      }`}
    >
      {children}
    </button>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account'); // 'account' | 'penalties'

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

        {/* Tab bar */}
        <div className="flex gap-2 bg-white/5 p-1 rounded-2xl border border-white/8">
          <Tab active={activeTab === 'account'} onClick={() => setActiveTab('account')}>
            Account
          </Tab>
          <Tab active={activeTab === 'penalties'} onClick={() => setActiveTab('penalties')}>
            🚨 Penalties
          </Tab>
        </div>

        {/* ── Account tab ── */}
        {activeTab === 'account' && (
          <div className="space-y-1 animate-fade-in">
            {[
              { icon: Clock,   label: 'Booking History',  path: '/history' },
              { icon: MapPin,  label: 'My Parking Slots', path: '/register-slot' },
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

            {/* Logout */}
            <div className="pt-4">
              <Button fullWidth variant="danger" icon={LogOut} onClick={handleLogout}>
                Log Out
              </Button>
            </div>
          </div>
        )}

        {/* ── Penalties tab ── */}
        {activeTab === 'penalties' && (
          <PenaltySection userId={user.id} pendingFine={user.pendingFine || 0} />
        )}

        {/* App info */}
        <div className="text-center py-2">
          <p className="text-white/20 text-xs">Easy Park v1.0.0</p>
          <p className="text-white/10 text-[10px] mt-1">Smart Peer-to-Peer Parking</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
