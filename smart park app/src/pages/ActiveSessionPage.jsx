import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useBooking } from '../contexts/BookingContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLocation as useLocationCtx } from '../contexts/LocationContext';
import { useCountdown } from '../hooks/useCountdown';
import {
  BOOKING_STATUS, GRACE_PERIOD_MS, EXIT_VALIDATION_MS,
  EXIT_GEOFENCE_M, ALERT_INTERVAL_MS, MAX_ALERTS_PER_BOOKING,
  EXTEND_OPTIONS,
} from '../utils/constants';
import { formatDuration, formatCurrency } from '../utils/formatters';
import { haversineDistance } from '../utils/geofence';
import { getPerMinuteRate } from '../utils/pricing';
import { saveReview } from '../lib/parkingApi';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import QRTicket from '../components/booking/QRTicket';
import SessionTimer from '../components/booking/SessionTimer';
import RatingModal from '../components/booking/RatingModal';
import {
  QrCode, LogOut, MapPin, Clock, AlertTriangle, CheckCircle2,
  Timer, Navigation, ShieldAlert, Plus, CreditCard, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { normalizeDbTimestampToIsoUtc } from '../utils/time';

/* ──────────────── Inline styles for post-session UI ──────────────── */
const postSessionStyles = `
  .grace-glow {
    animation: graceGlow 2s ease-in-out infinite;
  }
  @keyframes graceGlow {
    0%, 100% { box-shadow: 0 0 12px rgba(250,204,21,0.15); }
    50%       { box-shadow: 0 0 28px rgba(250,204,21,0.3); }
  }
  .exit-pulse {
    animation: exitPulse 1.5s ease-in-out infinite;
  }
  @keyframes exitPulse {
    0%, 100% { opacity: 0.7; }
    50%       { opacity: 1; }
  }
  .extend-opt {
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
  }
  .extend-opt:hover   { border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.08); }
  .extend-opt.active  { border-color: #3b82f6; background: rgba(59,130,246,0.15); }
  .alert-banner-anim {
    animation: alertSlide 0.4s cubic-bezier(.22,1,.36,1) both;
  }
  @keyframes alertSlide {
    from { opacity: 0; transform: translateY(-12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

export default function ActiveSessionPage() {
  const navigate = useNavigate();
  const { activeBooking, endSession, enterGracePeriod, extendSession, enterExitValidation, addWarning, flagMisuse } = useBooking();
  const { user, applyPendingFine } = useAuth();
  const { addNotification } = useNotification();
  const { currentLocation } = useLocationCtx();

  // ── Core UI state ──
  const [showQR, setShowQR] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [endedBookingSnapshot, setEndedBookingSnapshot] = useState(null);

  // ── Grace period state ──
  const [showExtendPicker, setShowExtendPicker] = useState(false);
  const [selectedExtend, setSelectedExtend] = useState(null);
  const [extendLoading, setExtendLoading] = useState(false);

  // ── Exit validation state ──
  const [exitChecking, setExitChecking] = useState(false);
  const [exitProgress, setExitProgress] = useState('');
  const [positionHistory, setPositionHistory] = useState([]);

  // ── Alert / warning state (grace period only) ──
  const [alertMessage, setAlertMessage] = useState('');
  const alertIntervalRef = useRef(null);
  const warningShown = useRef(false);
  // Guard: prevent firing the fine more than once
  const fineAppliedRef = useRef(false);
  // GPS jitter guard: require 2 consecutive outside-radius readings before ending
  const consecutiveExitRef = useRef(0);
  // Always-fresh ref to currentLocation so the GPS interval doesn't need to remount
  const currentLocationRef = useRef(currentLocation);

  // ── Session timer ──
  const sessionEndMs = activeBooking?.sessionEnd
    ? new Date(normalizeDbTimestampToIsoUtc(activeBooking.sessionEnd)).getTime()
    : null;
  const hasValidSessionEnd = Number.isFinite(sessionEndMs) && sessionEndMs > 0;
  const totalDurationSec = (activeBooking?.duration || 0) * 60;

  const { formatted, timeLeftSec, reset, start } = useCountdown(
    0,
    false,
    () => {
      // Timer expired → enter grace period instead of ending immediately
      enterGracePeriod();
      toast('⏰ Parking time is over! Please extend or leave.', { duration: 6000 });
    }
  );

  // ── Grace period countdown ──
  const graceStartMs = activeBooking?.graceStartedAt
    ? new Date(activeBooking.graceStartedAt).getTime()
    : null;

  const {
    formatted: graceFormatted,
    timeLeftSec: graceLeftSec,
    reset: graceReset,
    start: graceStart,
  } = useCountdown(0, false, () => {
    // Grace period expired — start alerting
    void handleGraceExpired();
  });

  // ── Exit validation countdown ──
  const exitStartMs = activeBooking?.exitValidationStartedAt
    ? new Date(activeBooking.exitValidationStartedAt).getTime()
    : null;

  const {
    formatted: exitFormatted,
    timeLeftSec: exitLeftSec,
    reset: exitReset,
    start: exitStart,
  } = useCountdown(0, false, () => {
    checkExitCondition();
  });

  // ── Start session countdown ──
  useEffect(() => {
    if (!hasValidSessionEnd || activeBooking?.status !== BOOKING_STATUS.ACTIVE) return;
    const ms = Math.max(sessionEndMs - Date.now(), 0);
    if (ms <= 0) return;
    reset(ms);
    start();
  }, [hasValidSessionEnd, sessionEndMs, activeBooking?.status, reset, start]);

  // ── Start grace countdown ──
  useEffect(() => {
    if (activeBooking?.status !== BOOKING_STATUS.GRACE_PERIOD || !graceStartMs) return;
    const ms = Math.max((graceStartMs + GRACE_PERIOD_MS) - Date.now(), 0);
    if (ms <= 0) return;
    graceReset(ms);
    graceStart();
  }, [activeBooking?.status, graceStartMs, graceReset, graceStart]);

  // Keep currentLocationRef fresh on every render
  useEffect(() => { currentLocationRef.current = currentLocation; }, [currentLocation]);

  // ── Start exit validation countdown ──
  useEffect(() => {
    if (activeBooking?.status !== BOOKING_STATUS.EXIT_VALIDATION || !exitStartMs) return;
    const ms = Math.max((exitStartMs + EXIT_VALIDATION_MS) - Date.now(), 0);
    exitReset(ms);
    exitStart();
    setExitChecking(true);
    setExitProgress('Tracking your location...');
    setPositionHistory([]);
    consecutiveExitRef.current = 0;   // reset counter when validation starts
    fineAppliedRef.current = false;   // reset fine guard too
  }, [activeBooking?.status, exitStartMs, exitReset, exitStart]);

  // ── Real-time GPS tracking during exit validation ──
  // Uses a stable interval (no currentLocation dep) via currentLocationRef so it
  // never restarts on every GPS tick. Requires CONSECUTIVE_EXIT_READS outside
  // readings before ending the session, preventing GPS jitter false positives.
  const CONSECUTIVE_EXIT_READS = 2; // 2 × 3 s = 6 s sustained departure
  useEffect(() => {
    if (activeBooking?.status !== BOOKING_STATUS.EXIT_VALIDATION) return;
    const slotLoc = activeBooking?.slotLocation;

    const id = setInterval(() => {
      const loc = currentLocationRef.current;
      if (!loc || !slotLoc) {
        consecutiveExitRef.current = 0; // can't confirm — reset
        return;
      }

      const dist = haversineDistance(loc.lat, loc.lng, slotLoc.lat, slotLoc.lng);

      // Update live distance display
      setPositionHistory((prev) => [...prev.slice(-10), { ...loc, t: Date.now(), dist }]);

      if (dist > EXIT_GEOFENCE_M) {
        consecutiveExitRef.current += 1;
        setExitProgress(
          consecutiveExitRef.current >= CONSECUTIVE_EXIT_READS
            ? '✅ Exit confirmed! Ending session...'
            : `✅ Outside zone (${Math.round(dist)}m) — confirming...`
        );

        if (consecutiveExitRef.current >= CONSECUTIVE_EXIT_READS) {
          // Sustained departure confirmed — end session
          setExitChecking(false);
          clearInterval(id);
          fineAppliedRef.current = true; // suppress timer-expiry fine
          setTimeout(() => finalEndSession(), 1000);
        }
      } else {
        // User is back inside (or reading was jitter) — reset counter
        consecutiveExitRef.current = 0;
        setExitProgress(`${Math.round(dist)}m from slot — need >${EXIT_GEOFENCE_M}m to exit`);
      }
    }, 3000);

    return () => clearInterval(id);
  // Only remount when validation status or slot location changes — NOT on every GPS tick
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBooking?.status, activeBooking?.slotLocation]);

  // 5-min warning before session end
  useEffect(() => {
    if (timeLeftSec > 0 && timeLeftSec <= 300 && !warningShown.current && activeBooking?.status === BOOKING_STATUS.ACTIVE) {
      warningShown.current = true;
      toast('⚠️ Less than 5 minutes remaining!', {
        duration: 5000,
        style: { background: '#1e293b', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' },
      });
    }
  }, [timeLeftSec, activeBooking?.status]);

  // ── Redirect guard ──
  useEffect(() => {
    if (!activeBooking && !sessionEnded && !showRating) {
      navigate('/');
    }
  }, [activeBooking, sessionEnded, showRating, navigate]);

  // ── Alert system (grace period expired — NOT exit validation) ──
  const handleGraceExpired = useCallback(async () => {
    setAlertMessage('⚠️ Grace period expired! Please leave the parking slot immediately.');
    const count = await addWarning();
    if (count >= MAX_ALERTS_PER_BOOKING) {
      await flagMisuse();
      toast.error('🚨 Misuse detected! A penalty will be applied to your next booking.', { duration: 8000 });
    }

    // Repeated alerts every 3 minutes (grace period overstay only)
    alertIntervalRef.current = setInterval(async () => {
      const wc = await addWarning();
      setAlertMessage(`⚠️ Alert #${wc}: You are still in the parking area. Please leave now!`);
      toast.error(`Alert #${wc}: Please leave the parking slot!`, { duration: 5000 });
      if (wc >= MAX_ALERTS_PER_BOOKING) {
        await flagMisuse();
        clearInterval(alertIntervalRef.current);
        toast.error('🚨 Misuse flagged! ₹50 penalty will be added to your next booking.', { duration: 8000 });
      }
    }, ALERT_INTERVAL_MS);
  }, [addWarning, flagMisuse]);

  // Cleanup alert interval
  useEffect(() => {
    return () => {
      if (alertIntervalRef.current) clearInterval(alertIntervalRef.current);
    };
  }, []);

  // ── Check exit condition (called when 2-min timer expires) ──
  // At this point, real-time tracking already handled departures.
  // If we reach here the user is STILL inside the geofence — apply fine immediately.
  const checkExitCondition = useCallback(() => {
    if (fineAppliedRef.current) return;  // already handled by real-time tracker
    fineAppliedRef.current = true;

    const slotLoc = activeBooking?.slotLocation;
    const dist = slotLoc && currentLocation
      ? haversineDistance(currentLocation.lat, currentLocation.lng, slotLoc.lat, slotLoc.lng)
      : null;

    // If somehow outside (race condition with real-time check), just end session cleanly
    if (dist !== null && dist > EXIT_GEOFENCE_M) {
      setExitProgress('✅ Exit confirmed!');
      setTimeout(() => finalEndSession(), 1000);
      return;
    }

    // Fine = 50% of this booking's total price (minimum ₹1)
    const fineAmount = Math.max(Math.round((activeBooking?.totalPrice || 0) * 0.5), 1);
    const distLabel = dist !== null ? `${Math.round(dist)}m` : 'unknown';
    const msg = `You did not leave the parking space within 2 minutes (distance: ${distLabel}). A ₹${fineAmount} fine (50% of your booking amount) has been added to your next booking.`;

    setExitProgress('❌ 2-minute window ended. You are still in the parking area.');
    setExitChecking(false);

    // Apply fine to user profile
    applyPendingFine(fineAmount);

    // Push persistent notification to bell icon
    addNotification('fine', `🚨 ₹${fineAmount} Overstay Fine`, msg);

    // Toast so user sees it immediately
    toast.error(`🚨 ₹${fineAmount} overstay fine applied! ${msg}`, { duration: 8000 });
  }, [activeBooking, currentLocation, applyPendingFine, addNotification]);

  // ── Final end session (after exit validation confirms user left) ──
  const finalEndSession = useCallback(() => {
    if (alertIntervalRef.current) clearInterval(alertIntervalRef.current);
    setEndedBookingSnapshot((snap) => snap || (activeBooking ? { ...activeBooking } : null));
    endSession();
    setShowRating(true);
    setExitChecking(false);
    setAlertMessage('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBooking, endSession]);

  // ── Manual end session ──
  const handleEndSession = () => {
    if (alertIntervalRef.current) clearInterval(alertIntervalRef.current);
    setEndedBookingSnapshot({ ...activeBooking });
    endSession();
    setShowRating(true);
    toast.success('Session ended. Thank you for parking with EasyPark!');
  };

  // ── "I Have Left" handler ──
  const handleIHaveLeft = () => {
    enterExitValidation();
    toast('📍 Verifying your exit...', { duration: 3000 });
  };

  // ── Extend parking handler ──
  const handleExtend = async () => {
    if (!selectedExtend || !activeBooking) return;
    setExtendLoading(true);
    try {
      const rate = getPerMinuteRate(activeBooking.pricing || {});
      const cost = Math.round(rate * selectedExtend.minutes);
      await extendSession(selectedExtend.minutes, cost);
      toast.success(`Extended by ${selectedExtend.label}! Extra: ₹${cost}`);
      setShowExtendPicker(false);
      setSelectedExtend(null);
      warningShown.current = false;
      if (alertIntervalRef.current) clearInterval(alertIntervalRef.current);
      setAlertMessage('');
    } catch (e) {
      toast.error(e?.message || 'Failed to extend');
    }
    setExtendLoading(false);
  };

  // ── Rating handlers ──
  const handleRatingSubmit = async (rating, comment) => {
    const snap = endedBookingSnapshot;
    if (!snap) { setShowRating(false); setSessionEnded(true); return; }
    setRatingSubmitting(true);
    try {
      await saveReview({
        slotId: snap.slotId,
        userId: snap.userId || user?.id,
        bookingId: snap.id,
        rating,
        comment,
        userName: snap.userName || user?.name || 'Anonymous',
      });
      toast.success('Thanks for your review! ⭐');
    } catch (e) {
      console.error('Failed to save review:', e);
    }
    setRatingSubmitting(false);
    setShowRating(false);
    setSessionEnded(true);
  };

  const handleRatingSkip = () => {
    setShowRating(false);
    setSessionEnded(true);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER STATES
  // ═══════════════════════════════════════════════════════════════

  // ── Rating modal ──
  if (showRating) {
    return (
      <RatingModal
        visible
        slotName={endedBookingSnapshot?.slotName || 'this slot'}
        loading={ratingSubmitting}
        onSubmit={handleRatingSubmit}
        onSkip={handleRatingSkip}
      />
    );
  }

  // ── Session complete screen ──
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

  // ── Loading state ──
  if (activeBooking.status === BOOKING_STATUS.ACTIVE && !hasValidSessionEnd) {
    return <LoadingSpinner message="Starting your session..." />;
  }

  const isWarning = timeLeftSec <= 300 && timeLeftSec > 0 && activeBooking.status === BOOKING_STATUS.ACTIVE;
  const isGrace = activeBooking.status === BOOKING_STATUS.GRACE_PERIOD;
  const isExitVal = activeBooking.status === BOOKING_STATUS.EXIT_VALIDATION;
  const warningCount = activeBooking.warningCount || 0;

  return (
    <>
      <style>{postSessionStyles}</style>
      <div className="min-h-screen bg-navy-900 pb-24">
        <Navbar
          title={isGrace ? 'Grace Period' : isExitVal ? 'Exit Verification' : 'Active Session'}
          showBack
          onBack={() => navigate('/')}
        />

        <div className="px-4 py-4 max-w-lg mx-auto space-y-4 animate-fade-in">

          {/* ═══ ALERT BANNER ═══ */}
          {alertMessage && (
            <div className="alert-banner-anim bg-rose-500/12 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-rose-400">{alertMessage}</p>
                {warningCount > 0 && (
                  <p className="text-xs text-rose-300/60 mt-1">
                    Warnings: {warningCount}/{MAX_ALERTS_PER_BOOKING}
                    {warningCount >= MAX_ALERTS_PER_BOOKING && ' — Misuse flagged!'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ═══ GRACE PERIOD UI ═══ */}
          {isGrace && (
            <>
              <div className="grace-glow rounded-2xl bg-amber-500/8 border border-amber-500/20 p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
                  <Timer className="w-8 h-8 text-amber-400" />
                </div>
                <p className="text-lg font-bold text-amber-300 mb-1">Grace Period</p>
                <p className="text-xs text-white/40 mb-4">Your parking time has ended. Please extend or leave.</p>
                <p className="text-3xl font-bold text-white tabular-nums">{graceFormatted}</p>
                <p className="text-[11px] text-white/30 mt-1">remaining before alerts begin</p>
              </div>

              {/* Extend or Leave buttons */}
              <div className="flex gap-3">
                <Button
                  fullWidth
                  icon={Plus}
                  onClick={() => setShowExtendPicker(true)}
                  className="!bg-gradient-to-r !from-electric-500 !to-blue-600"
                >
                  Extend Parking
                </Button>
                <Button
                  fullWidth
                  variant="danger"
                  icon={Navigation}
                  onClick={handleIHaveLeft}
                >
                  I Have Left
                </Button>
              </div>

              {/* Extension picker */}
              {showExtendPicker && (
                <Card className="animate-slide-down">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                    Select Extension Time
                  </h3>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {EXTEND_OPTIONS.map((opt) => {
                      const rate = getPerMinuteRate(activeBooking.pricing || {});
                      const cost = Math.round(rate * opt.minutes);
                      return (
                        <div
                          key={opt.minutes}
                          className={`extend-opt rounded-xl p-3 text-center ${
                            selectedExtend?.minutes === opt.minutes ? 'active' : ''
                          }`}
                          onClick={() => setSelectedExtend(opt)}
                        >
                          <p className="text-sm font-semibold text-white">{opt.label}</p>
                          <p className="text-xs text-electric-400 font-bold mt-1">₹{cost}</p>
                        </div>
                      );
                    })}
                  </div>
                  {selectedExtend && (
                    <Button
                      fullWidth
                      icon={CreditCard}
                      loading={extendLoading}
                      onClick={handleExtend}
                    >
                      Pay & Extend ({selectedExtend.label})
                    </Button>
                  )}
                </Card>
              )}
            </>
          )}

          {/* ═══ EXIT VALIDATION UI ═══ */}
          {isExitVal && (
            <div className="rounded-2xl bg-blue-500/8 border border-blue-500/20 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-4">
                <Navigation className="w-8 h-8 text-blue-400 exit-pulse" />
              </div>
              <p className="text-lg font-bold text-blue-300 mb-1">Verifying Your Exit</p>
              <p className="text-xs text-white/40 mb-4">Move {EXIT_GEOFENCE_M}m away from the slot to confirm exit</p>
              <p className="text-3xl font-bold text-white tabular-nums mb-3">{exitFormatted}</p>

              {/* Live distance progress bar */}
              {(() => {
                const liveDist = positionHistory.length > 0
                  ? (positionHistory[positionHistory.length - 1].dist ?? null)
                  : (currentLocation && activeBooking.slotLocation
                      ? haversineDistance(
                          currentLocation.lat, currentLocation.lng,
                          activeBooking.slotLocation.lat, activeBooking.slotLocation.lng,
                        )
                      : null);
                const pct = liveDist !== null ? Math.min((liveDist / EXIT_GEOFENCE_M) * 100, 100) : 0;
                const isClose = liveDist !== null && liveDist > EXIT_GEOFENCE_M * 0.6;
                return liveDist !== null ? (
                  <div className="mt-1 mb-3">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-white/40">0m</span>
                      <span className={`font-bold ${pct >= 100 ? 'text-emerald-400' : isClose ? 'text-amber-400' : 'text-white/60'}`}>
                        {Math.round(liveDist)}m / {EXIT_GEOFENCE_M}m
                      </span>
                      <span className="text-white/40">{EXIT_GEOFENCE_M}m</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          pct >= 100 ? 'bg-emerald-500' : isClose ? 'bg-amber-400' : 'bg-rose-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ) : null;
              })()}

              <p className="text-sm text-white/50 mt-1">{exitProgress || 'Tracking your location...'}</p>
            </div>
          )}

          {/* ═══ ACTIVE SESSION UI (normal timer) ═══ */}
          {activeBooking.status === BOOKING_STATUS.ACTIVE && (
            <>
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
            </>
          )}

          {/* ═══ BOOKING DETAILS CARD ═══ */}
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
              {warningCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-sm">Warnings</span>
                  <span className={`text-sm font-bold ${warningCount >= MAX_ALERTS_PER_BOOKING ? 'text-rose-400' : 'text-amber-400'}`}>
                    {warningCount} / {MAX_ALERTS_PER_BOOKING}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* QR Code toggle */}
          {activeBooking.status === BOOKING_STATUS.ACTIVE && (
            <>
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

              {/* End session early */}
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
            </>
          )}

          {/* Force end (available during alerts) */}
          {(isGrace || alertMessage) && !isExitVal && !showExtendPicker && (
            <Button
              fullWidth
              variant="ghost"
              icon={Ban}
              onClick={handleEndSession}
              className="text-white/30 hover:text-white/50"
            >
              End Session & Leave Review
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
