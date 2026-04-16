import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useBooking } from '../contexts/BookingContext';
import { useCountdown } from '../hooks/useCountdown';
import { WARNING_BEFORE_END_MS } from '../utils/constants';
import { formatDuration, formatCurrency } from '../utils/formatters';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import QRTicket from '../components/booking/QRTicket';
import SessionTimer from '../components/booking/SessionTimer';
import { QrCode, LogOut, MapPin, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ActiveSessionPage() {
  const navigate = useNavigate();
  const { activeBooking, endSession } = useBooking();
  const [showQR, setShowQR] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const warningShown = useRef(false);

  // Calculate remaining session time
  const sessionEnd = activeBooking?.sessionEnd
    ? new Date(activeBooking.sessionEnd).getTime()
    : Date.now();
  const remaining = Math.max(sessionEnd - Date.now(), 0);
  const totalDurationSec = (activeBooking?.duration || 0) * 60;

  const { formatted, timeLeftSec, isExpired, isRunning } = useCountdown(
    remaining,
    true,
    () => {
      toast.success('Parking session ended!');
      endSession();
      setSessionEnded(true);
    }
  );

  // Show warning 5 minutes before end
  useEffect(() => {
    if (
      timeLeftSec > 0 &&
      timeLeftSec <= 300 &&
      !warningShown.current
    ) {
      warningShown.current = true;
      toast('⚠️ Less than 5 minutes remaining!', {
        duration: 5000,
        style: {
          background: '#1e293b',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        },
      });
    }
  }, [timeLeftSec]);

  // Redirect if no active booking
  useEffect(() => {
    if (!activeBooking && !sessionEnded) {
      navigate('/');
    }
  }, [activeBooking, sessionEnded, navigate]);

  const handleEndSession = () => {
    endSession();
    setSessionEnded(true);
    toast.success('Session ended. Thank you for parking with EasyPark!');
  };

  // Session ended screen
  if (sessionEnded) {
    return (
      <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center px-6 text-center">
        <div className="animate-scale-in">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Session Complete!</h2>
          <p className="text-white/50 text-sm mb-8">
            Thank you for using EasyPark. Drive safely!
          </p>
          <Button onClick={() => navigate('/')} fullWidth>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (!activeBooking) return null;

  const isWarning = timeLeftSec <= 300 && timeLeftSec > 0;

  return (
    <div className="min-h-screen bg-navy-900 pb-24">
      <Navbar title="Active Session" showBack={false} />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4 animate-fade-in">
        {/* Timer */}
        <div className={`flex flex-col items-center py-6 ${isWarning ? 'animate-pulse' : ''}`}>
          <p className="text-xs text-white/40 uppercase tracking-widest mb-4">
            Parking Time Remaining
          </p>
          <SessionTimer
            timeLeftSec={timeLeftSec}
            totalSec={totalDurationSec}
            formatted={formatted}
            isWarning={isWarning}
            size={220}
          />
        </div>

        {/* Warning banner */}
        {isWarning && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2 animate-slide-up">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Time Running Low!</p>
              <p className="text-xs text-white/50">
                Your parking session will end soon. Please prepare to leave.
              </p>
            </div>
          </div>
        )}

        {/* Booking details */}
        <Card>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
            Booking Details
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <MapPin className="w-4 h-4" />
                Location
              </div>
              <span className="text-white text-sm font-medium">{activeBooking.slotName}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <Clock className="w-4 h-4" />
                Duration
              </div>
              <span className="text-white text-sm font-medium">
                {formatDuration(activeBooking.duration)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">Amount Paid</span>
              <span className="text-emerald-400 text-sm font-bold">
                {formatCurrency(activeBooking.totalPrice)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">Reference</span>
              <span className="text-electric-400 text-sm font-bold tracking-wider">
                {activeBooking.ref}
              </span>
            </div>
          </div>
        </Card>

        {/* QR Code toggle */}
        <Button
          fullWidth
          variant="secondary"
          icon={QrCode}
          onClick={() => setShowQR(!showQR)}
        >
          {showQR ? 'Hide' : 'Show'} Parking Ticket
        </Button>

        {showQR && (
          <div className="animate-scale-in">
            <QRTicket booking={activeBooking} />
          </div>
        )}

        {/* End session */}
        {showEndConfirm ? (
          <div className="flex gap-2">
            <Button fullWidth variant="danger" onClick={handleEndSession}>
              Yes, End Session
            </Button>
            <Button fullWidth variant="secondary" onClick={() => setShowEndConfirm(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            fullWidth
            variant="ghost"
            icon={LogOut}
            onClick={() => setShowEndConfirm(true)}
            className="text-rose-400/60 hover:text-rose-400"
          >
            End Session Early
          </Button>
        )}
      </div>
    </div>
  );
}
