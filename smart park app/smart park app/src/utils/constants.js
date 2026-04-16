// App-wide constants

export const DURATION_OPTIONS = [
  { label: '20 min', minutes: 20, key: 'min20' },
  { label: '30 min', minutes: 30, key: 'min30' },
  { label: '40 min', minutes: 40, key: 'min40' },
  { label: '1 hour', minutes: 60, key: 'hr1' },
  { label: '2 hours', minutes: 120, key: 'hr2' },
  { label: '3 hours', minutes: 180, key: 'hr3' },
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
  OCCUPIED: 'occupied',
};

export const BOOKING_STATUS = {
  LOCKED: 'locked',
  ARRIVED: 'arrived',
  PAID: 'paid',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
};

export const LOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes
export const GEOFENCE_RADIUS_M = 100; // 100 meters
export const WARNING_BEFORE_END_MS = 5 * 60 * 1000; // 5 minutes
export const SEARCH_RADIUS_KM = 3; // 3km radius for nearby slots

export const DEFAULT_MAP_ZOOM = 15;
export const DEFAULT_LOCATION = { lat: 13.0827, lng: 80.2707 }; // Chennai

// Demo wallet balance
export const INITIAL_WALLET_BALANCE = 500;
