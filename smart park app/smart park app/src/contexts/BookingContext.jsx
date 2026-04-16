import { createContext, useContext, useState, useEffect } from 'react';
import { updateSlotStatus, getStoredSlots, saveSlots } from '../data/demoSlots';
import { generateBookingRef } from '../utils/formatters';
import { BOOKING_STATUS, SLOT_STATUS } from '../utils/constants';

const BookingContext = createContext(null);

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used within BookingProvider');
  return ctx;
}

export function BookingProvider({ children }) {
  const [activeBooking, setActiveBooking] = useState(null);
  const [bookingHistory, setBookingHistory] = useState([]);

  // Load persisted booking on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('easypark_active_booking');
      if (stored) {
        const booking = JSON.parse(stored);
        // Check if booking is still valid
        if (booking.status === BOOKING_STATUS.LOCKED) {
          const lockExpiry = new Date(booking.lockedAt).getTime() + 10 * 60 * 1000;
          if (Date.now() > lockExpiry) {
            // Lock expired
            expireBooking(booking);
            return;
          }
        }
        setActiveBooking(booking);
      }

      const history = localStorage.getItem('easypark_booking_history');
      if (history) {
        setBookingHistory(JSON.parse(history));
      }
    } catch (e) {
      console.error('Failed to load booking:', e);
    }
  }, []);

  // Persist active booking
  useEffect(() => {
    if (activeBooking) {
      localStorage.setItem('easypark_active_booking', JSON.stringify(activeBooking));
    } else {
      localStorage.removeItem('easypark_active_booking');
    }
  }, [activeBooking]);

  const expireBooking = (booking) => {
    updateSlotStatus(booking.slotId, SLOT_STATUS.AVAILABLE);
    const expired = { ...booking, status: BOOKING_STATUS.EXPIRED };
    addToHistory(expired);
    setActiveBooking(null);
  };

  const addToHistory = (booking) => {
    setBookingHistory((prev) => {
      const updated = [booking, ...prev];
      localStorage.setItem('easypark_booking_history', JSON.stringify(updated));
      return updated;
    });
  };

  /**
   * Lock a slot — creates a new booking
   */
  const lockSlot = (slot, duration, totalPrice, vehicleType, userId, userName) => {
    updateSlotStatus(slot.id, SLOT_STATUS.LOCKED);

    const booking = {
      id: `booking-${Date.now()}`,
      ref: generateBookingRef(),
      userId,
      userName,
      slotId: slot.id,
      slotName: slot.name,
      slotAddress: slot.address,
      slotLocation: slot.location,
      duration, // in minutes
      totalPrice,
      vehicleType,
      status: BOOKING_STATUS.LOCKED,
      lockedAt: new Date().toISOString(),
      paidAt: null,
      sessionStart: null,
      sessionEnd: null,
      paymentMethod: null,
      createdAt: new Date().toISOString(),
    };

    setActiveBooking(booking);
    return booking;
  };

  /**
   * Confirm arrival at the parking slot
   */
  const confirmArrival = () => {
    setActiveBooking((prev) => {
      if (!prev) return prev;
      return { ...prev, status: BOOKING_STATUS.ARRIVED };
    });
  };

  /**
   * Complete payment
   */
  const completePayment = (paymentMethod) => {
    setActiveBooking((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: BOOKING_STATUS.PAID,
        paidAt: new Date().toISOString(),
        paymentMethod,
      };
    });
  };

  /**
   * Start parking session
   */
  const startSession = () => {
    updateSlotStatus(activeBooking?.slotId, SLOT_STATUS.OCCUPIED);
    const now = new Date();
    const endTime = new Date(now.getTime() + (activeBooking?.duration || 0) * 60 * 1000);

    setActiveBooking((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: BOOKING_STATUS.ACTIVE,
        sessionStart: now.toISOString(),
        sessionEnd: endTime.toISOString(),
      };
    });
  };

  /**
   * End session (manual or auto)
   */
  const endSession = () => {
    if (activeBooking) {
      updateSlotStatus(activeBooking.slotId, SLOT_STATUS.AVAILABLE);
      const completed = { ...activeBooking, status: BOOKING_STATUS.COMPLETED };
      addToHistory(completed);
    }
    setActiveBooking(null);
  };

  /**
   * Cancel / expire lock
   */
  const cancelBooking = () => {
    if (activeBooking) {
      updateSlotStatus(activeBooking.slotId, SLOT_STATUS.AVAILABLE);
      const expired = { ...activeBooking, status: BOOKING_STATUS.EXPIRED };
      addToHistory(expired);
    }
    setActiveBooking(null);
  };

  const value = {
    activeBooking,
    bookingHistory,
    lockSlot,
    confirmArrival,
    completePayment,
    startSession,
    endSession,
    cancelBooking,
    hasActiveBooking: !!activeBooking,
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
}
