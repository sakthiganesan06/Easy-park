import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useBooking } from '../contexts/BookingContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDuration } from '../utils/formatters';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PaymentMethodPicker from '../components/payment/PaymentMethodPicker';
import {
  CreditCard, MapPin, Clock, Car, Wallet,
  CheckCircle, Shield, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PaymentPage() {
  const navigate = useNavigate();
  const { activeBooking, completePayment, startSession } = useBooking();
  const { user, updateWallet } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

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
      if ((user?.walletBalance || 0) < activeBooking.totalPrice) {
        return toast.error('Insufficient wallet balance');
      }
    }

    setLoading(true);

    // Simulate payment processing
    await new Promise((r) => setTimeout(r, 2500));

    // Deduct from wallet if needed
    if (paymentMethod === 'wallet') {
      updateWallet(-activeBooking.totalPrice);
    }

    completePayment(paymentMethod);
    setPaymentSuccess(true);
    setLoading(false);
    toast.success('Payment successful!');
  };

  const handleStartSession = () => {
    startSession();
    navigate('/session');
  };

  if (!activeBooking) return null;

  // Payment success screen
  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-navy-900">
        <Navbar title="Payment Complete" showBack={false} showWallet={false} />
        <div className="px-4 py-8 max-w-lg mx-auto text-center animate-scale-in">
          {/* Success animation */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-emerald-400" />
            </div>
            <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-emerald-500/30 animate-pulse-ring" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
          <p className="text-white/50 text-sm mb-6">
            Your parking has been confirmed
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

          <Button fullWidth size="lg" variant="success" onClick={handleStartSession}>
            Start Parking Session
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 pb-32">
      <Navbar title="Payment" showBack showWallet />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4 animate-fade-in">
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
            {formatCurrency(activeBooking.totalPrice)}
          </p>
        </Card>

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
              Pay {formatCurrency(activeBooking.totalPrice)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
