import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { generateBookingRef } from '../utils/formatters';
import { BOOKING_STATUS, LOCK_DURATION_MS, PAYMENT_DURATION_MS, MAX_ALERTS_PER_BOOKING } from '../utils/constants';
import toast from 'react-hot-toast';
import { useLocation as useLocationCtx } from './LocationContext';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { normalizeDbTimestampToIsoUtc } from '../utils/time';
import { parseSlotQrPayload } from '../utils/qr';
import {
  createBooking as createBookingDb,
  lockSlot as lockSlotDb,
  startSession as startSessionDb,
  endSession as endSessionDb,
  cancelBooking as cancelBookingDb,
  updateBookingStatus as updateBookingStatusDb,
  extendBookingSession as extendBookingSessionDb,
  recordBookingWarning as recordWarningDb,
  markBookingMisuse as markMisuseDb,
  savePaymentDetails as savePaymentDetailsDb,
} from '../lib/parkingApi';

const BookingContext = createContext(null);

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used within BookingProvider');
  return ctx;
}

export function BookingProvider({ children }) {
  const { currentLocation } = useLocationCtx();
  const { user, applyPendingFine } = useAuth();
  const { addNotification } = useNotification();
  const [activeBooking, setActiveBooking] = useState(null);
  const [bookingHistory, setBookingHistory] = useState([]);

  const activeBookingKey = user?.id ? `easypark_active_booking_${user.id}` : null;
  const bookingHistoryKey = user?.id ? `easypark_booking_history_${user.id}` : null;

  const addToHistory = useCallback((booking) => {
    if (!bookingHistoryKey) return;
    setBookingHistory((prev) => {
      const key = booking?.id || booking?.ref;
      const exists = key && prev.some((b) => (b?.id || b?.ref) === key);
      if (exists) return prev;
      const updated = [booking, ...prev];
      localStorage.setItem(bookingHistoryKey, JSON.stringify(updated));
      return updated;
    });
  }, [bookingHistoryKey]);

  /** Cancel booking in Supabase, set slot available again, clear local active booking. */
  const releaseExpiredLockBooking = useCallback(async (booking, { silent = false } = {}) => {
    if (!booking?.id) return;
    try {
      await cancelBookingDb(booking.id);
    } catch (e) {
      console.error('EasyPark: failed to cancel booking / release slot', e);
    }
    const expired = { ...booking, status: BOOKING_STATUS.EXPIRED };
    addToHistory(expired);
    setActiveBooking(null);
    if (!silent) {
      toast('Lock time ended — booking cancelled and the slot is available again.', {
        icon: '⏱️',
        duration: 5000,
      });
    }
  }, [addToHistory]);

  // Load persisted booking/history scoped to current user
  useEffect(() => {
    if (!user?.id) {
      setActiveBooking(null);
      setBookingHistory([]);
      return;
    }

    try {
      const history = localStorage.getItem(bookingHistoryKey);
      if (history) {
        const parsed = JSON.parse(history);
        const deduped = [];
        const seen = new Set();
        for (const b of Array.isArray(parsed) ? parsed : []) {
          if (b?.userId && b.userId !== user.id) continue;
          const key = b?.id || b?.ref;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          deduped.push(b);
        }
        setBookingHistory(deduped);
        localStorage.setItem(bookingHistoryKey, JSON.stringify(deduped));
      } else {
        setBookingHistory([]);
      }

      const stored = localStorage.getItem(activeBookingKey);
      if (!stored) {
        setActiveBooking(null);
        return;
      }
      const booking = JSON.parse(stored);
      if (booking.status === BOOKING_STATUS.LOCKED && booking.lockedAt) {
        const lockExpiry = new Date(booking.lockedAt).getTime() + LOCK_DURATION_MS;
        if (Date.now() > lockExpiry) {
          localStorage.removeItem(activeBookingKey);
          void releaseExpiredLockBooking(booking, { silent: false });
          setActiveBooking(null);
          return;
        }
      }
      // Also check payment timer for arrived status
      if (booking.status === BOOKING_STATUS.ARRIVED && booking.arrivedAt) {
        const paymentExpiry = new Date(booking.arrivedAt).getTime() + PAYMENT_DURATION_MS;
        if (Date.now() > paymentExpiry) {
          localStorage.removeItem(activeBookingKey);
          void releaseExpiredLockBooking(booking, { silent: false });
          setActiveBooking(null);
          return;
        }
      }
      setActiveBooking(booking);
    } catch (e) {
      console.error('Failed to load booking:', e);
    }
  }, [user?.id, activeBookingKey, bookingHistoryKey, releaseExpiredLockBooking]);

  // Persist active booking
  useEffect(() => {
    if (!activeBookingKey) return;
    if (activeBooking) {
      localStorage.setItem(activeBookingKey, JSON.stringify(activeBooking));
    } else {
      localStorage.removeItem(activeBookingKey);
    }
  }, [activeBooking, activeBookingKey]);

  // Auto-release lock after 10 min even if user left Lock screen (updates DB + map via realtime)
  useEffect(() => {
    if (!activeBooking || activeBooking.status !== BOOKING_STATUS.LOCKED || !activeBooking.lockedAt) {
      return undefined;
    }
    const snapshot = activeBooking;
    const tick = async () => {
      const lockExpiry = new Date(snapshot.lockedAt).getTime() + LOCK_DURATION_MS;
      if (Date.now() <= lockExpiry) return;
      await releaseExpiredLockBooking(snapshot, { silent: false });
    };
    const id = setInterval(() => void tick(), 5000);
    void tick();
    return () => clearInterval(id);
  }, [activeBooking, releaseExpiredLockBooking]);

  // Auto-cancel if payment not completed within 5 min of arrival
  useEffect(() => {
    if (!activeBooking || activeBooking.status !== BOOKING_STATUS.ARRIVED || !activeBooking.arrivedAt) {
      return undefined;
    }
    const snapshot = activeBooking;
    const tick = async () => {
      const payExpiry = new Date(snapshot.arrivedAt).getTime() + PAYMENT_DURATION_MS;
      if (Date.now() <= payExpiry) return;
      await releaseExpiredLockBooking(snapshot, { silent: false });
      toast('Payment time expired — booking cancelled.', { icon: '⏱️', duration: 5000 });
    };
    const id = setInterval(() => void tick(), 5000);
    void tick();
    return () => clearInterval(id);
  }, [activeBooking, releaseExpiredLockBooking]);

  /**
   * Lock a slot — creates a new booking
   */
  const lockSlot = async (slot, duration, totalPrice, vehicleType, userId, userName) => {
    const userLat = currentLocation?.lat;
    const userLng = currentLocation?.lng;

    const { booking } = await createBookingDb(userId, slot.id, duration, userLat, userLng);
    await lockSlotDb(slot.id);

    const bookingObj = {
      id: booking.id,
      ref: generateBookingRef(),
      userId,
      userName,
      slotId: slot.id,
      slotName: slot.name,
      slotAddress: slot.address,
      slotLocation: slot.location,
      slotQrToken: slot.qrToken || null,
      duration, // in minutes
      totalPrice,
      vehicleType,
      status: BOOKING_STATUS.LOCKED,
      lockedAt: new Date().toISOString(),
      paidAt: null,
      sessionStart: null,
      sessionEnd: null,
      qrVerified: false,
      qrVerifiedAt: null,
      paymentMethod: null,
      createdAt: new Date().toISOString(),
    };

    setActiveBooking(bookingObj);
    return bookingObj;
  };

  /**
   * Confirm arrival at the parking slot — syncs to DB
   */
  const confirmArrival = async () => {
    if (!activeBooking?.id) return;
    await updateBookingStatusDb(activeBooking.id, 'arrived');
    setActiveBooking((prev) => {
      if (!prev) return prev;
      return { ...prev, status: BOOKING_STATUS.ARRIVED, arrivedAt: new Date().toISOString() };
    });
  };

  /**
   * Complete payment — syncs full payment details to DB
   * @param {string} paymentMethod
   * @param {{ penaltyAmount?: number, extensionMinutes?: number, extensionAmount?: number }} extras
   */
  const completePayment = async (paymentMethod, extras = {}) => {
    if (!activeBooking?.id) return;
    const baseAmount = activeBooking.totalPrice || 0;
    const penaltyAmount = extras.penaltyAmount || 0;
    const extensionMinutes = extras.extensionMinutes || 0;
    const extensionAmount = extras.extensionAmount || 0;
    const totalAmount = baseAmount + penaltyAmount + extensionAmount;

    await savePaymentDetailsDb(activeBooking.id, {
      paymentMethod,
      baseAmount,
      penaltyAmount,
      extensionMinutes,
      extensionAmount,
      totalAmount,
    });

    setActiveBooking((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: BOOKING_STATUS.PAID,
        paidAt: new Date().toISOString(),
        paymentMethod,
        totalPaid: totalAmount,
        penaltyAmount,
      };
    });
  };

  const verifySlotQr = (rawScan) => {
    if (!activeBooking) return { ok: false, error: 'No active booking found' };
    const parsed = parseSlotQrPayload(rawScan);
    if (!parsed?.slotId) return { ok: false, error: 'Invalid slot QR' };
    if (parsed.slotId !== activeBooking.slotId) {
      return { ok: false, error: 'Wrong parking slot scanned. Please scan the QR at your booked slot.' };
    }
    if (activeBooking.slotQrToken) {
      if (!parsed.qrToken) {
        return { ok: false, error: 'Scan the full slot QR (with security token), not a short link.' };
      }
      if (parsed.qrToken !== activeBooking.slotQrToken) {
        return { ok: false, error: 'QR token mismatch. Please scan the correct slot QR.' };
      }
    }

    setActiveBooking((prev) => (prev ? {
      ...prev,
      qrVerified: true,
      qrVerifiedAt: new Date().toISOString(),
    } : prev));

    return { ok: true };
  };

  /**
   * Start parking session (only after qrVerified was set separately — prefer verifyAndStartSession from payment flow)
   */
  const startSession = async () => {
    if (!activeBooking?.id) return;
    if (!activeBooking.qrVerified) {
      throw new Error('Scan and verify the parking slot QR before starting session');
    }
    const updated = await startSessionDb(activeBooking.id);

    setActiveBooking((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: BOOKING_STATUS.ACTIVE,
        sessionStart: normalizeDbTimestampToIsoUtc(updated.start_time),
        sessionEnd: normalizeDbTimestampToIsoUtc(updated.end_time),
      };
    });
  };

  /**
   * Validate scanned slot QR and start the DB session in one step (timer begins only after a match).
   */
  const verifyAndStartSession = useCallback(
    async (rawScan) => {
      const booking = activeBooking;
      if (!booking?.id) throw new Error('No active booking found');
      const parsed = parseSlotQrPayload(String(rawScan || '').trim());
      if (!parsed?.slotId) throw new Error('Invalid slot QR');
      if (parsed.slotId !== booking.slotId) {
        throw new Error('Wrong parking slot. Scan the QR at your booked location.');
      }
      if (booking.slotQrToken) {
        if (!parsed.qrToken) {
          throw new Error('Scan the full slot QR (with security token), not a short link.');
        }
        if (parsed.qrToken !== booking.slotQrToken) {
          throw new Error('QR token mismatch. Scan the correct slot QR.');
        }
      }

      const updated = await startSessionDb(booking.id);

      flushSync(() => {
        setActiveBooking((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            qrVerified: true,
            qrVerifiedAt: new Date().toISOString(),
            status: BOOKING_STATUS.ACTIVE,
            sessionStart: normalizeDbTimestampToIsoUtc(updated.start_time),
            sessionEnd: normalizeDbTimestampToIsoUtc(updated.end_time),
          };
        });
      });
    },
    [activeBooking]
  );

  /**
   * End session (manual or auto)
   */
  const endSession = async () => {
    if (!activeBooking?.id) return;
    await endSessionDb(activeBooking.id);
    const completed = { ...activeBooking, status: BOOKING_STATUS.COMPLETED };
    addToHistory(completed);
    setActiveBooking(null);
  };

  /**
   * Enter grace period — session time is over but user hasn't confirmed leaving.
   * Does NOT end the DB session yet; keeps the slot locked.
   */
  const enterGracePeriod = () => {
    setActiveBooking((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: BOOKING_STATUS.GRACE_PERIOD,
        graceStartedAt: new Date().toISOString(),
        warningCount: prev.warningCount || 0,
      };
    });
  };

  /**
   * Extend session by extraMinutes (from grace period).
   * Updates DB end_time, resets to ACTIVE status locally.
   */
  const extendSession = async (extraMinutes, extraCost) => {
    if (!activeBooking?.id) throw new Error('No active booking');
    const updated = await extendBookingSessionDb(activeBooking.id, extraMinutes);
    setActiveBooking((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: BOOKING_STATUS.ACTIVE,
        duration: updated.duration || (prev.duration + extraMinutes),
        totalPrice: (prev.totalPrice || 0) + (extraCost || 0),
        sessionEnd: normalizeDbTimestampToIsoUtc(updated.end_time),
        graceStartedAt: null,
      };
    });
  };

  /**
   * Enter exit validation mode (GPS tracking to confirm user left).
   */
  const enterExitValidation = () => {
    setActiveBooking((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: BOOKING_STATUS.EXIT_VALIDATION,
        exitValidationStartedAt: new Date().toISOString(),
      };
    });
  };

  /**
   * Record a warning (user hasn't left after grace period).
   * On the 5th warning, automatically applies a ₹10 fine to the next booking.
   */
  const addWarning = async () => {
    if (!activeBooking?.id) return 0;
    try {
      await recordWarningDb(activeBooking.id, activeBooking.userId || user?.id);
    } catch (e) {
      console.error('Failed to record warning to DB:', e);
    }
    let newCount = 0;
    setActiveBooking((prev) => {
      if (!prev) return prev;
      newCount = (prev.warningCount || 0) + 1;
      return { ...prev, warningCount: newCount };
    });

    // Push a warning notification for the bell icon
    addNotification(
      'warning',
      `⚠️ Parking Warning #${newCount}`,
      `You are still in the parking area after your session ended. Please leave immediately.`
    );

    // On the 5th warning — apply a fine of 50% of booking price
    if (newCount >= MAX_ALERTS_PER_BOOKING) {
      // Read latest booking price inside setter to avoid stale closure
      setActiveBooking((prev) => {
        if (!prev) return prev;
        const fineAmount = Math.max(Math.round((prev.totalPrice || 0) * 0.5), 1);
        applyPendingFine(fineAmount);
        addNotification(
          'fine',
          `🚨 ₹${fineAmount} Overstay Fine Applied`,
          `You received ${MAX_ALERTS_PER_BOOKING} overstay warnings. A ₹${fineAmount} fine (50% of your booking amount of ₹${prev.totalPrice}) has been added to your next booking.`
        );
        return prev; // no state change needed here
      });
    }

    return newCount;
  };

  /**
   * Mark the current booking as misuse (5+ warnings).
   */
  const flagMisuse = async () => {
    if (!activeBooking?.id) return;
    try {
      await markMisuseDb(activeBooking.id, activeBooking.userId || user?.id);
    } catch (e) {
      console.error('Failed to mark misuse in DB:', e);
    }
    setActiveBooking((prev) => (prev ? { ...prev, misuse: true } : prev));
  };

  /**
   * Cancel lock / booking (user action — no extra toast here; caller may toast)
   */
  const cancelBooking = async () => {
    if (!activeBooking?.id) return;
    await releaseExpiredLockBooking(activeBooking, { silent: true });
  };

  const value = {
    activeBooking,
    bookingHistory,
    lockSlot,
    confirmArrival,
    completePayment,
    verifySlotQr,
    startSession,
    verifyAndStartSession,
    endSession,
    cancelBooking,
    enterGracePeriod,
    extendSession,
    enterExitValidation,
    addWarning,
    flagMisuse,
    hasActiveBooking: !!activeBooking,
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
}
