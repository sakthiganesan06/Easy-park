// App-wide constants

export const DURATION_OPTIONS = [
  { label: '1 min',  minutes: 1,   key: 'min1'  },
  { label: '20 min', minutes: 20,  key: 'min20' },
  { label: '30 min', minutes: 30,  key: 'min30' },
  { label: '40 min', minutes: 40,  key: 'min40' },
  { label: '1 hour', minutes: 60,  key: 'hr1'   },
  { label: '2 hours', minutes: 120, key: 'hr2'  },
  { label: '3 hours', minutes: 180, key: 'hr3'  },
];

export const VEHICLE_TYPES = [
  { id: 'car', label: 'Car', icon: 'Car' },
  { id: 'bike', label: 'Bike', icon: 'Bike' },
  { id: 'auto', label: 'Auto', icon: 'Truck' },
  { id: 'truck', label: 'Truck', icon: 'Truck' },
];

export const SLOT_STATUS = {
  AVAILABLE: 'available',
  LOCKED: 'locked',
  BOOKING: 'booking',   // arrived, payment in progress
  BOOKED: 'booked',     // paid or active session
  OCCUPIED: 'occupied',
};

export const BOOKING_STATUS = {
  LOCKED: 'locked',
  ARRIVED: 'arrived',
  PAID: 'paid',
  ACTIVE: 'active',
  GRACE_PERIOD: 'grace_period',
  EXIT_VALIDATION: 'exit_validation',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
};

export const LOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes
export const PAYMENT_DURATION_MS = 5 * 60 * 1000; // 5 minutes to complete payment after arrival
export const GEOFENCE_RADIUS_M = 100; // 100 meters
/** Max distance from slot (meters) required to start a booking */
export const BOOKING_GEOFENCE_METERS = 1000;
export const WARNING_BEFORE_END_MS = 5 * 60 * 1000; // 5 minutes
export const SEARCH_RADIUS_KM = 3; // 3km radius for nearby slots

// ─── Grace Period & Exit Validation ─────────────────────────────────────────
export const GRACE_PERIOD_MS = 5 * 60 * 1000;       // 5 min grace after session ends
export const EXIT_VALIDATION_MS = 2 * 60 * 1000;    // 2 min GPS tracking window
export const EXIT_GEOFENCE_M = 50;                   // must exit 50m radius
export const ALERT_INTERVAL_MS = 3 * 60 * 1000;     // alert every 3 min if still parked
export const MAX_ALERTS_PER_BOOKING = 5;             // 5 alerts = misuse
export const PENALTY_AMOUNT = 50;                    // ₹50 penalty surcharge
export const FINE_AMOUNT = 10;                       // ₹10 fine for overstay (5 warnings)
export const MULTI_BOOKING_WARN_THRESHOLD = 3;       // 3 bookings with warnings = penalty

// Extension pricing tiers (minutes & multiplier of per-minute rate)
export const EXTEND_OPTIONS = [
  { label: '1 min',  minutes: 1  },
  { label: '10 min', minutes: 10 },
  { label: '20 min', minutes: 20 },
  { label: '30 min', minutes: 30 },
  { label: '40 min', minutes: 40 },
  { label: '1 hour', minutes: 60 },
];

export const DEFAULT_MAP_ZOOM = 15;
export const DEFAULT_LOCATION = { lat: 13.0827, lng: 80.2707 }; // Chennai

// Demo wallet balance
export const INITIAL_WALLET_BALANCE = 500;
