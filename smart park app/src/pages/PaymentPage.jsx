import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useBooking } from '../contexts/BookingContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { formatCurrency, formatDuration } from '../utils/formatters';
import { PAYMENT_DURATION_MS, PENALTY_AMOUNT, MAX_ALERTS_PER_BOOKING } from '../utils/constants';
import { getUserPenaltyInfo, clearUserPenalty } from '../lib/parkingApi';
import { useCountdown } from '../hooks/useCountdown';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import PaymentMethodPicker from '../components/payment/PaymentMethodPicker';
import SlotQrScanner from '../components/booking/SlotQrScanner';
import {
  CreditCard, MapPin, Clock, Car, Wallet,
  CheckCircle, Shield, Loader2, ScanLine, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

/** Small countdown banner for the 5-min payment window. */
function PaymentCountdown({ arrivedAt }) {
  const deadline = new Date(arrivedAt).getTime() + PAYMENT_DURATION_MS;
  const { formatted, timeLeftSec } = useCountdown(
    Math.max(deadline - Date.now(), 0),
    true
  );
  const isUrgent = timeLeftSec <= 60;
  return (
    <div className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${
      isUrgent
        ? 'bg-rose-500/10 border-rose-500/30'
        : 'bg-amber-500/10 border-amber-500/30'
    }`}>
      <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${isUrgent ? 'text-rose-400' : 'text-amber-400'}`} />
      <div className="flex-1">
        <p className={`text-xs font-medium ${isUrgent ? 'text-rose-400' : 'text-amber-400'}`}>
          Complete payment within
        </p>
        <p className={`text-lg font-bold tabular-nums ${isUrgent ? 'text-rose-300' : 'text-amber-300'}`}>
          {formatted}
        </p>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const { activeBooking, completePayment, verifyAndStartSession } = useBooking();
  const { user, updateWallet, clearPendingFine } = useAuth();
  const { addNotification } = useNotification();

  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [pasteStart, setPasteStart] = useState('');
  const startingSessionRef = useRef(false);
  const [penaltyInfo, setPenaltyInfo] = useState(null);

  // Check for penalties on mount
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const info = await getUserPenaltyInfo(user.id);
        if (info.hasPenalty) setPenaltyInfo(info);
      } catch (e) {
        console.error('Failed to check penalty:', e);
      }
    })();
  }, [user?.id]);

  const penaltyAmount = penaltyInfo?.hasPenalty ? PENALTY_AMOUNT : 0;
  // ₹10 overstay fine from previous session (stored on user profile)
  const overstayFine = user?.pendingFine || 0;
  const totalWithPenalty = (activeBooking?.totalPrice || 0) + penaltyAmount + overstayFine;

  useEffect(() => {
    if (!activeBooking) {
      navigate('/');
      return;
    }
    if (activeBooking.status === 'active') {
      navigate('/session');
      return;
    }
    if (activeBooking.status === 'paid') {
      setPaymentSuccess(true);
    }
  }, [activeBooking, navigate]);

  const handlePayment = async () => {
    if (paymentMethod === 'upi' && !upiId.includes('@')) {
      return toast.error('Please enter a valid UPI ID');
    }

    if (paymentMethod === 'wallet') {
      if ((user?.walletBalance || 0) < totalWithPenalty) {
        return toast.error('Insufficient wallet balance');
      }
    }

    setLoading(true);

    // Simulate payment processing
    await new Promise((r) => setTimeout(r, 2500));

    // Deduct from wallet if needed
    if (paymentMethod === 'wallet') {
      updateWallet(-totalWithPenalty);
    }

    try {
      await completePayment(paymentMethod, {
        penaltyAmount: penaltyAmount + overstayFine,
        extensionMinutes: 0,
        extensionAmount: 0,
      });
      // Clear DB-level penalty after successful payment
      if (penaltyInfo?.hasPenalty) {
        try { await clearUserPenalty(user.id); } catch {}
        setPenaltyInfo(null);
      }
      // Clear ₹10 overstay fine
      if (overstayFine > 0) clearPendingFine();

      // Send notification if any penalty was included
      const totalFine = penaltyAmount + overstayFine;
      if (totalFine > 0) {
        addNotification(
          'info',
          '✅ Penalty Payment Confirmed',
          `₹${totalFine} penalty has been successfully paid as part of your booking. Your account is now clear.`
        );
      }

      setPaymentSuccess(true);
      toast.success('Payment successful!');
    } catch (e) {
      toast.error(e?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const runStartAfterQr = async (raw) => {
    if (startingSessionRef.current) return;
    startingSessionRef.current = true;
    setLoading(true);
    try {
      await verifyAndStartSession(raw);
      toast.success('Slot verified — your parking timer has started.');
      setShowScanner(false);
      setPasteStart('');
      navigate('/session');
    } catch (e) {
      toast.error(e?.message || 'Failed to start session');
    } finally {
      setLoading(false);
      startingSessionRef.current = false;
    }
  };

  const handleScanSuccess = (decodedText) => {
    runStartAfterQr(decodedText);
  };

  if (!activeBooking) return null;

  // Payment success screen
  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-navy-900">
        <Navbar
          title="Payment Complete"
          showBack
          onBack={() => navigate('/', { replace: true })}
          showWallet={false}
        />
        <div className="px-4 py-8 max-w-lg mx-auto text-center animate-scale-in">
          {/* Success animation */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-emerald-400" />
            </div>
            <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-emerald-500/30 animate-pulse-ring" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
          <p className="text-white/50 text-sm mb-2">
            Your parking has been confirmed
          </p>
          <p className="text-white/35 text-xs mb-6 px-2">
            Your session timer starts only after you scan the QR at this parking slot (same code the owner displays).
          </p>

          {/* Summary */}
          <Card className="text-left mb-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-sm">Location</span>
                <span className="text-white text-sm font-medium">{activeBooking.slotName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-sm">Duration</span>
                <span className="text-white text-sm font-medium">
                  {formatDuration(activeBooking.duration)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-sm">Amount Paid</span>
                <span className="text-emerald-400 text-sm font-bold">
                  {formatCurrency(activeBooking.totalPrice)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-sm">Payment Method</span>
                <span className="text-white text-sm font-medium capitalize">
                  {activeBooking.paymentMethod || paymentMethod}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-sm">Booking Ref</span>
                <span className="text-electric-400 text-sm font-bold tracking-wider">
                  {activeBooking.ref}
                </span>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <Button
              fullWidth
              size="lg"
              variant="success"
              icon={ScanLine}
              loading={loading}
              onClick={() => setShowScanner(true)}
            >
              Scan slot QR &amp; start timer
            </Button>
          </div>

          <Modal
            isOpen={showScanner}
            onClose={() => !loading && setShowScanner(false)}
            title="Start your parking session"
            className="sm:max-w-lg"
          >
            <p className="text-sm text-white/60 mb-4">
              Scan the QR at your booked slot. The timer starts only when the code matches this booking.
            </p>
            {!loading && (
              <div className="rounded-xl overflow-hidden border border-white/10 bg-black/20 mb-4">
                <SlotQrScanner onScanSuccess={handleScanSuccess} />
              </div>
            )}
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-10 h-10 text-electric-400 animate-spin" />
              </div>
            )}
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Or paste QR text</label>
              <textarea
                value={pasteStart}
                onChange={(e) => setPasteStart(e.target.value)}
                placeholder='{"app":"easypark","slotId":"...","qrToken":"..."}'
                rows={3}
                disabled={loading}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-electric-500/40 font-mono disabled:opacity-50"
              />
              <Button
                type="button"
                fullWidth
                variant="secondary"
                className="mt-2"
                disabled={loading || !pasteStart.trim()}
                onClick={() => runStartAfterQr(pasteStart)}
              >
                Start with pasted code
              </Button>
            </div>
          </Modal>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 pb-32">
      <Navbar title="Payment" showBack showWallet onBack={() => navigate('/')} />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4 animate-fade-in">
        {/* Payment timer */}
        {activeBooking.arrivedAt && (
          <PaymentCountdown arrivedAt={activeBooking.arrivedAt} />
        )}
        {/* Booking summary */}
        <Card>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
            Booking Summary
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-electric-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">{activeBooking.slotName}</p>
                <p className="text-xs text-white/40">{activeBooking.slotAddress}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-white">{formatDuration(activeBooking.duration)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-white/40" />
                <span className="text-sm text-white capitalize">{activeBooking.vehicleType}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Total amount */}
        <Card className="text-center">
          <p className="text-xs text-white/40 uppercase tracking-wider">Total Amount</p>
          <p className="text-4xl font-bold text-electric-400 mt-1">
            {formatCurrency(totalWithPenalty)}
          </p>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex items-center justify-between text-white/40 px-2">
              <span>Parking fee</span>
              <span>{formatCurrency(activeBooking?.totalPrice || 0)}</span>
            </div>
            {penaltyAmount > 0 && (
              <div className="flex items-center justify-between text-rose-400/80 px-2">
                <span>Misuse penalty</span>
                <span>+{formatCurrency(penaltyAmount)}</span>
              </div>
            )}
            {overstayFine > 0 && (
              <div className="flex items-center justify-between text-rose-400 px-2 font-semibold">
                <span>⚠️ Overstay fine</span>
                <span>+{formatCurrency(overstayFine)}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Misuse penalty notice */}
        {penaltyInfo?.hasPenalty && (
          <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-rose-400">Penalty Applied</p>
              <p className="text-xs text-white/50">
                A ₹{PENALTY_AMOUNT} surcharge has been added due to previous parking misuse
                ({penaltyInfo.totalWarnings} total warnings across {penaltyInfo.warningBookings} booking{penaltyInfo.warningBookings !== 1 ? 's' : ''}).
              </p>
            </div>
          </div>
        )}

        {/* Overstay fine notice */}
        {overstayFine > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-rose-400">₹{overstayFine} Overstay Fine</p>
              <p className="text-xs text-white/50">
                You received {MAX_ALERTS_PER_BOOKING} overstay warnings in your last session.
                This ₹{overstayFine} fine will be cleared after this payment.
              </p>
            </div>
          </div>
        )}

        {/* Payment methods */}
        <div>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 px-1">
            Payment Method
          </h3>
          <PaymentMethodPicker
            selected={paymentMethod}
            onSelect={setPaymentMethod}
          />
        </div>

        {/* UPI input */}
        {paymentMethod === 'upi' && (
          <Card className="animate-slide-down">
            <label className="block text-sm text-white/60 mb-2">UPI ID</label>
            <input
              type="text"
              placeholder="yourname@upi"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="input-field"
            />
          </Card>
        )}

        {/* Wallet balance */}
        {paymentMethod === 'wallet' && (
          <Card className="animate-slide-down">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-white">Wallet Balance</span>
              </div>
              <span className={`text-lg font-bold ${
                (user?.walletBalance || 0) >= activeBooking.totalPrice
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}>
                {formatCurrency(user?.walletBalance || 0)}
              </span>
            </div>
            {(user?.walletBalance || 0) < activeBooking.totalPrice && (
              <p className="text-xs text-rose-400 mt-2">
                Insufficient balance. You need {formatCurrency(activeBooking.totalPrice - (user?.walletBalance || 0))} more.
              </p>
            )}
          </Card>
        )}

        {/* Security note */}
        <div className="flex items-center gap-2 px-1">
          <Shield className="w-4 h-4 text-emerald-400/60" />
          <p className="text-xs text-white/30">Payments are secured and encrypted</p>
        </div>

        {/* Pay button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-navy-900/95 backdrop-blur-xl border-t border-white/5 z-30">
          <div className="max-w-lg mx-auto">
            <Button
              fullWidth
              size="lg"
              icon={loading ? Loader2 : CreditCard}
              loading={loading}
              onClick={handlePayment}
            >
              Pay {formatCurrency(totalWithPenalty)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
