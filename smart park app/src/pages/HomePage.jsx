import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useLocation as useLocationCtx } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import { useBooking } from '../contexts/BookingContext';
import { haversineDistance, getDistanceText } from '../utils/geofence';
import { formatCurrency } from '../utils/formatters';
import {
  SEARCH_RADIUS_KM,
  DEFAULT_MAP_ZOOM,
  SLOT_STATUS,
  BOOKING_STATUS,
  LOCK_DURATION_MS,
} from '../utils/constants';
import { useTimeUntil } from '../hooks/useTimeUntil';
import { getNearbySlots, seedDemoSlots, subscribeToSlots } from '../lib/parkingApi';
import { slotRowQrPayload } from '../utils/qr';
import { downloadQrAsPng, downloadQrAsSvg } from '../utils/qrDownload';
import Navbar from '../components/layout/Navbar';
import BottomNav from '../components/layout/BottomNav';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { QRCode } from 'react-qr-code';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  MapPin, Navigation, Star, Car, Bike, Truck, ChevronUp, ChevronDown,
  Search, PlusCircle, AlertCircle, LocateFixed, Download, Timer, ChevronRight, X,
  ArrowRight, XCircle, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// User location marker
const userIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div class="user-marker"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Slot marker by status
function createSlotIcon(price, status) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-price ${status}">₹${price}</div>`,
    iconSize: [60, 36],
    iconAnchor: [30, 36],
  });
}

function formatLockCountdown(remainingMs) {
  const sec = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function MapPopupLockTimer({ lockExpiresAt, slotId }) {
  const { activeBooking } = useBooking();
  
  // If this is the user's own locked booking, use its lock time
  const isOwnLockedSlot = activeBooking?.status === BOOKING_STATUS.LOCKED && 
                          activeBooking?.slotId === slotId;
  
  let effectiveExpiresAt = lockExpiresAt;
  if (isOwnLockedSlot && activeBooking?.lockedAt) {
    effectiveExpiresAt = new Date(new Date(activeBooking.lockedAt).getTime() + LOCK_DURATION_MS).toISOString();
  }
  
  const remainingMs = useTimeUntil(effectiveExpiresAt);
  
  // If no expiration time or timer is null, don't show anything
  if (effectiveExpiresAt == null || remainingMs === null) return null;
  
  const text = `Time left: ${formatLockCountdown(remainingMs)}`;
  return (
    <p className="text-amber-300/95 text-xs mt-2 font-medium tabular-nums tracking-tight">
      {text}
    </p>
  );
}

function FloatingLockCountdown({ lockExpiresIso }) {
  const remainingMs = useTimeUntil(lockExpiresIso);
  if (!lockExpiresIso || remainingMs === null) {
    return <span className="tabular-nums font-bold text-amber-200">—</span>;
  }
  if (remainingMs <= 0) {
    return <span className="tabular-nums font-bold text-amber-200/80">0:00</span>;
  }
  return (
    <span className="tabular-nums font-bold text-amber-200">{formatLockCountdown(remainingMs)}</span>
  );
}

// Component to recenter map
function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

const POST_REGISTER_QR_PROPS = {
  size: 220,
  level: 'M',
  fgColor: '#000000',
  bgColor: '#FFFFFF',
};

const POST_REGISTER_STORAGE_KEY = 'easypark_post_register_slot';

export default function HomePage() {
  const navigate = useNavigate();
  const postRegisterQrRef = useRef(null);
  const { currentLocation, locationGranted, locationError, loading: locLoading, requestLocation } = useLocationCtx();
  const { user } = useAuth();
  const { hasActiveBooking, activeBooking, cancelBooking } = useBooking();

  const [slots, setSlots] = useState([]);
  const [postRegisterSlot, setPostRegisterSlot] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingFabModalOpen, setBookingFabModalOpen] = useState(false);
  const sheetHeight = '55vh';
  const sheetPeekHeight = '80px';

  const activeLockExpiresIso = useMemo(() => {
    if (activeBooking?.status !== BOOKING_STATUS.LOCKED || !activeBooking?.lockedAt) return null;
    return new Date(new Date(activeBooking.lockedAt).getTime() + LOCK_DURATION_MS).toISOString();
  }, [activeBooking?.status, activeBooking?.lockedAt]);

  useEffect(() => {
    if (!activeBooking) {
      setBookingFabModalOpen(false);
    }
  }, [activeBooking]);

  // Request location on mount
  useEffect(() => {
    if (!locationGranted && !locLoading) {
      requestLocation();
    }
  }, [locationGranted, locLoading, requestLocation]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(POST_REGISTER_STORAGE_KEY);
      if (!raw) return;
      const row = JSON.parse(raw);
      if (row?.id) setPostRegisterSlot(row);
    } catch {
      sessionStorage.removeItem(POST_REGISTER_STORAGE_KEY);
    }
  }, []);

  const dismissPostRegisterQr = () => {
    setPostRegisterSlot(null);
    try {
      sessionStorage.removeItem(POST_REGISTER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  // Load/seed demo slots when location is available
  useEffect(() => {
    if (!currentLocation) return;
    let mounted = true;
    (async () => {
      try {
        let rows = await getNearbySlots(currentLocation.lat, currentLocation.lng);
        if (rows.length === 0 && user?.id && !localStorage.getItem('easypark_seeded_slots')) {
          await seedDemoSlots(user.id, currentLocation.lat, currentLocation.lng);
          localStorage.setItem('easypark_seeded_slots', '1');
          rows = await getNearbySlots(currentLocation.lat, currentLocation.lng);
        }
        const uiSlots = rows.map((row) => ({
            id: row.id,
            ownerId: row.owner_id,
            ownerName: 'Owner',
            ownerPhone: row.owner_phone || '',
            location: { lat: row.latitude, lng: row.longitude },
            address: row.address || '',
            name: row.name || 'Parking Slot',
            pricing: row.pricing || {},
            vehicleTypes: row.vehicle_types || [],
            imageUrl: null,
            status: row.effective_status || (row.is_available ? SLOT_STATUS.AVAILABLE : SLOT_STATUS.LOCKED),
            rating: '4.0',
            totalSpots: 5,
            createdAt: row.created_at,
            lockExpiresAt: row.lock_expires_at || null,
          }));
        if (!mounted) return;
        setSlots(uiSlots);
      } catch (e) {
        toast.error(e?.message || 'Failed to load slots');
      }
    })();
    return () => { mounted = false; };
  }, [currentLocation, user?.id]);

  // Realtime updates
  useEffect(() => {
    if (!currentLocation) return undefined;
    const unsubscribe = subscribeToSlots(async () => {
      try {
        const rows = await getNearbySlots(currentLocation.lat, currentLocation.lng);
        const uiSlots = rows.map((row) => ({
            id: row.id,
            ownerId: row.owner_id,
            ownerName: 'Owner',
            ownerPhone: row.owner_phone || '',
            location: { lat: row.latitude, lng: row.longitude },
            address: row.address || '',
            name: row.name || 'Parking Slot',
            pricing: row.pricing || {},
            vehicleTypes: row.vehicle_types || [],
            imageUrl: null,
            status: row.effective_status || (row.is_available ? SLOT_STATUS.AVAILABLE : SLOT_STATUS.LOCKED),
            rating: '4.0',
            totalSpots: 5,
            createdAt: row.created_at,
            lockExpiresAt: row.lock_expires_at || null,
          }));
        setSlots(uiSlots);
      } catch {
        // ignore
      }
    });
    return unsubscribe;
  }, [currentLocation]);

  // NOTE: auto-redirect removed — user can stay on the home page and use the
  // floating booking icon to navigate back to their booking flow at any time.

  // Sorted slots by distance — also override the user's own booking slot status locally
  const sortedSlots = useMemo(() => {
    if (!currentLocation || !slots.length) return [];
    return slots
      .map((slot) => {
        let status = slot.status;
        let lockExpiresAt = slot.lockExpiresAt;

        // Override status for the user's own active booking slot
        if (activeBooking && slot.id === activeBooking.slotId) {
          switch (activeBooking.status) {
            case BOOKING_STATUS.LOCKED:
              status = SLOT_STATUS.LOCKED;
              if (activeBooking.lockedAt) {
                lockExpiresAt = new Date(new Date(activeBooking.lockedAt).getTime() + LOCK_DURATION_MS).toISOString();
              }
              break;
            case BOOKING_STATUS.ARRIVED:
              status = SLOT_STATUS.BOOKING;
              break;
            case BOOKING_STATUS.PAID:
            case BOOKING_STATUS.ACTIVE:
              status = SLOT_STATUS.BOOKED;
              break;
            default:
              break;
          }
        }

        return {
          ...slot,
          status,
          lockExpiresAt,
          distance: haversineDistance(
            currentLocation.lat, currentLocation.lng,
            slot.location.lat, slot.location.lng
          ),
        };
      })
      .filter((s) => s.distance <= SEARCH_RADIUS_KM * 1000)
      .sort((a, b) => a.distance - b.distance);
  }, [slots, currentLocation, activeBooking]);

  const filteredSlots = useMemo(() => {
    if (!searchQuery) return sortedSlots;
    const q = searchQuery.toLowerCase();
    return sortedSlots.filter(
      (s) => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
    );
  }, [sortedSlots, searchQuery]);

  const availableCount = filteredSlots.filter((s) => s.status === SLOT_STATUS.AVAILABLE).length;

  if (locLoading) {
    return <LoadingSpinner message="Getting your location..." />;
  }

  if (!currentLocation) {
    return (
      <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="w-16 h-16 text-amber-400 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Location Required</h2>
        <p className="text-white/50 text-sm mb-6">
          Easy Park needs your location to find nearby parking spaces.
        </p>
        <Button onClick={requestLocation} icon={LocateFixed}>
          Enable Location
        </Button>
        {locationError && (
          <p className="text-rose-400 text-xs mt-3">{locationError}</p>
        )}
      </div>
    );
  }

  const vehicleIcon = (type) => {
    switch (type) {
      case 'car': return <Car className="w-3 h-3" />;
      case 'bike': return <Bike className="w-3 h-3" />;
      default: return <Truck className="w-3 h-3" />;
    }
  };

  return (
    <div className="h-screen bg-navy-900 flex flex-col overflow-hidden">
      <Navbar />

      {activeBooking?.status === 'paid' && (
        <div className="shrink-0 px-4 py-2.5 bg-emerald-500/15 border-b border-emerald-500/25 flex items-center justify-between gap-3 max-w-lg mx-auto w-full">
          <p className="text-xs text-emerald-100/90">
            Payment done — scan the slot QR to start your parking timer.
          </p>
          <button
            type="button"
            onClick={() => navigate('/payment')}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
          >
            Continue
          </button>
        </div>
      )}

      {/* Map */}
      <div className="relative flex-1 min-h-0">
        <MapContainer
          center={[currentLocation.lat, currentLocation.lng]}
          zoom={DEFAULT_MAP_ZOOM}
          className="w-full h-full"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          <MapRecenter lat={currentLocation.lat} lng={currentLocation.lng} />

          {/* Search radius circle */}
          <Circle
            center={[currentLocation.lat, currentLocation.lng]}
            radius={SEARCH_RADIUS_KM * 1000}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.04,
              weight: 1,
              dashArray: '8 4',
            }}
          />

          {/* User marker */}
          <Marker
            position={[currentLocation.lat, currentLocation.lng]}
            icon={userIcon}
          />

          {/* Slot markers */}
          {filteredSlots.map((slot) => (
            <Marker
              key={slot.id}
              position={[slot.location.lat, slot.location.lng]}
              icon={createSlotIcon(slot.pricing.min20, slot.status)}
              eventHandlers={{
                click: () => {
                  navigate(`/slot/${slot.id}`);
                },
              }}
            >
              <Popup>
                <div className="p-3 min-w-[200px]">
                  <h3 className="font-bold text-white text-sm mb-1">{slot.name}</h3>
                  <p className="text-white/50 text-xs mb-2">{slot.address}</p>
                  <div className="flex items-center justify-between">
                    <Badge status={slot.status} />
                    <span className="text-electric-400 font-bold text-sm">from ₹{slot.pricing.min20}</span>
                  </div>
                  {slot.status === SLOT_STATUS.LOCKED && slot.lockExpiresAt && (
                    <MapPopupLockTimer lockExpiresAt={slot.lockExpiresAt} slotId={slot.id} />
                  )}
                  {slot.status === SLOT_STATUS.BOOKING && (
                    <p className="text-violet-400/90 text-xs mt-2 font-medium">Payment in progress…</p>
                  )}
                  {slot.status === SLOT_STATUS.BOOKED && (
                    <p className="text-red-400/90 text-xs mt-2 font-medium">Currently in use</p>
                  )}
                  {slot.status === SLOT_STATUS.AVAILABLE && (
                    <button
                      onClick={() => navigate(`/slot/${slot.id}`)}
                      className="mt-2 w-full btn-primary py-2 text-xs"
                    >
                      View & Book
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Map overlay buttons */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
          <button
            onClick={() => {
              const map = document.querySelector('.leaflet-container');
              if (map?._leaflet_id) {
                // Force recenter
                requestLocation();
              }
            }}
            className="w-10 h-10 bg-navy-800/90 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center hover:bg-navy-700 transition-colors"
          >
            <LocateFixed className="w-5 h-5 text-electric-400" />
          </button>
        </div>

        {/* Register slot FAB */}
        <button
          onClick={() => navigate('/register-slot')}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold px-4 py-3 rounded-2xl shadow-glow-emerald hover:shadow-lg transition-all active:scale-95"
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-sm">Register Slot</span>
        </button>

      </div>

      {/* Active booking floating icon — fixed above bottom sheet */}
      {activeBooking && (
        <button
          type="button"
          onClick={() => setBookingFabModalOpen(true)}
          className="fixed bottom-44 right-4 z-[1250] w-14 h-14 rounded-full bg-gradient-to-br from-electric-500 to-electric-600 text-white shadow-glow-electric flex items-center justify-center hover:shadow-lg transition-all active:scale-90 animate-pulse-slow"
          aria-label="Active booking"
        >
          <Timer className="w-6 h-6" />
        </button>
      )}

      {/* Bottom sheet */}
      <div
        className="bottom-sheet"
        style={{
          height: sheetHeight,
          transform: sheetOpen
            ? 'translateY(0)'
            : `translateY(calc(100% - ${sheetPeekHeight}))`,
        }}
      >
        <div className="h-full flex flex-col">
          {/* Handle */}
          <div className="w-full flex flex-col items-center pt-3 pb-2">
            <div className="w-10 h-1 bg-white/20 rounded-full mb-2" />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/50">
                <span className="text-emerald-400 font-bold">{availableCount}</span> spots available nearby
              </span>
              <button
                type="button"
                onClick={() => setSheetOpen((prev) => !prev)}
                className="p-1 rounded-md text-white/40 hover:text-white/70 transition-colors"
                aria-label={sheetOpen ? 'Collapse slots list' : 'Expand slots list'}
              >
                {sheetOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search parking spots..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-electric-500/50"
              />
            </div>
          </div>

          {/* Slot list */}
          {sheetOpen && (
            <div className="flex-1 min-h-0">
              <div className="h-full overflow-y-auto px-4 pt-2 pb-24">
                <div className="space-y-3">
                  {filteredSlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => navigate(`/slot/${slot.id}`)}
                      className="w-full text-left"
                    >
                      <Card hover className="!p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-bold text-white truncate">{slot.name}</h3>
                              <Badge status={slot.status} />
                            </div>
                            <p className="text-xs text-white/40 truncate mb-2">{slot.address}</p>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1 text-xs text-white/50">
                                <Navigation className="w-3 h-3" />
                                {getDistanceText(slot.distance)}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-amber-400">
                                <Star className="w-3 h-3 fill-current" />
                                {slot.rating}
                              </div>
                              <div className="flex items-center gap-1">
                                {slot.vehicleTypes.map((t) => (
                                  <span key={t} className="text-white/30">{vehicleIcon(t)}</span>
                                ))}
                              </div>
                            </div>
                            {slot.status === SLOT_STATUS.LOCKED && (
                              <MapPopupLockTimer lockExpiresAt={slot.lockExpiresAt} slotId={slot.id} />
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-electric-400">₹{slot.pricing.min20}</p>
                            <p className="text-[10px] text-white/30">per 20 min</p>
                          </div>
                        </div>
                      </Card>
                    </button>
                  ))}

                  {filteredSlots.length === 0 && (
                    <div className="text-center py-8">
                      <MapPin className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-white/30 text-sm">No parking spots found nearby</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav />

      {/* Active booking modal */}
      <Modal
        isOpen={bookingFabModalOpen && !!activeBooking}
        onClose={() => setBookingFabModalOpen(false)}
        title="Active Booking"
      >
        {activeBooking && (
          <div className="space-y-4">
            {/* Slot info */}
            <Card className="!p-4">
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-electric-400" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{activeBooking.slotName}</p>
                  <p className="text-xs text-white/45">{activeBooking.slotAddress}</p>
                </div>
              </div>
            </Card>

            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                activeBooking.status === BOOKING_STATUS.ACTIVE         ? 'bg-emerald-400 animate-pulse' :
                activeBooking.status === BOOKING_STATUS.PAID           ? 'bg-electric-400' :
                activeBooking.status === BOOKING_STATUS.ARRIVED        ? 'bg-electric-400' :
                activeBooking.status === BOOKING_STATUS.GRACE_PERIOD   ? 'bg-amber-400 animate-pulse' :
                activeBooking.status === BOOKING_STATUS.EXIT_VALIDATION ? 'bg-blue-400 animate-pulse' :
                'bg-amber-400 animate-pulse'
              }`} />
              <span className="text-sm font-semibold text-white capitalize">
                {activeBooking.status === BOOKING_STATUS.LOCKED          ? 'Slot Reserved — Heading to park' :
                 activeBooking.status === BOOKING_STATUS.ARRIVED         ? 'Arrived — Payment pending' :
                 activeBooking.status === BOOKING_STATUS.PAID            ? 'Paid — Scan QR to start' :
                 activeBooking.status === BOOKING_STATUS.ACTIVE          ? 'Session Active' :
                 activeBooking.status === BOOKING_STATUS.GRACE_PERIOD    ? '⏰ Grace Period — Extend or leave' :
                 activeBooking.status === BOOKING_STATUS.EXIT_VALIDATION ? '🛷 Exit Validation — 2 min timer' :
                 activeBooking.status}
              </span>
            </div>

            {/* Urgent banner for grace / exit validation */}
            {(activeBooking.status === BOOKING_STATUS.GRACE_PERIOD ||
              activeBooking.status === BOOKING_STATUS.EXIT_VALIDATION) && (
              <div className={`rounded-xl px-4 py-3 border text-xs ${
                activeBooking.status === BOOKING_STATUS.EXIT_VALIDATION
                  ? 'bg-blue-500/10 border-blue-500/25 text-blue-300'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
              }`}>
                {activeBooking.status === BOOKING_STATUS.EXIT_VALIDATION
                  ? '🛷 Your 2-minute exit window is running. Tap Continue to check your exit status.'
                  : '⚠️ Grace period active. Tap Continue to extend your time or confirm you’ve left.'}
              </div>
            )}

            {/* Lock timer (only for locked status) */}
            {activeBooking.status === BOOKING_STATUS.LOCKED && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                <p className="text-xs text-white/40 mb-1">Lock timer</p>
                {activeLockExpiresIso ? (
                  <FloatingLockCountdown lockExpiresIso={activeLockExpiresIso} />
                ) : (
                  <p className="text-sm text-amber-200/90">Timer unavailable</p>
                )}
              </div>
            )}

            {/* Booking details */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/50">
              {activeBooking.duration != null && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Duration: <span className="text-white/80">{activeBooking.duration} min</span>
                </span>
              )}
              {activeBooking.vehicleType && (
                <span className="flex items-center gap-1">
                  <Car className="w-3 h-3" />
                  Vehicle: <span className="text-white/80 capitalize">{activeBooking.vehicleType}</span>
                </span>
              )}
              {activeBooking.totalPrice != null && (
                <span>
                  Total:{' '}
                  <span className="font-semibold text-electric-400">
                    {formatCurrency(activeBooking.totalPrice)}
                  </span>
                </span>
              )}
            </div>

            {/* Continue button */}
            <Button
              fullWidth
              icon={ArrowRight}
              onClick={() => {
                setBookingFabModalOpen(false);
                if (activeBooking.status === BOOKING_STATUS.LOCKED) {
                  navigate('/lock');
                } else if (activeBooking.status === BOOKING_STATUS.ARRIVED || activeBooking.status === BOOKING_STATUS.PAID) {
                  navigate('/payment');
                } else if (
                  activeBooking.status === BOOKING_STATUS.ACTIVE ||
                  activeBooking.status === BOOKING_STATUS.GRACE_PERIOD ||
                  activeBooking.status === BOOKING_STATUS.EXIT_VALIDATION
                ) {
                  navigate('/session');
                }
              }}
            >
              Continue Booking
            </Button>

            {/* Cancel button */}
            <Button
              fullWidth
              variant="danger"
              icon={XCircle}
              onClick={async () => {
                setBookingFabModalOpen(false);
                await cancelBooking();
                toast('Booking cancelled', { icon: '❌' });
              }}
            >
              Cancel Booking
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!postRegisterSlot}
        onClose={dismissPostRegisterQr}
        title={postRegisterSlot ? `${postRegisterSlot.name || 'Parking Slot'} — your QR` : 'Your QR'}
      >
        {postRegisterSlot && (
          <div className="space-y-4">
            <p className="text-sm text-white/50">
              Print or display this at the entrance. Bookings are only allowed after this code is scanned.
            </p>
            <div className="bg-white rounded-2xl p-4 flex justify-center items-center min-h-[240px] w-full [&_svg]:!block [&_svg]:!max-w-none [&_svg]:!h-auto">
              <div ref={postRegisterQrRef} className="inline-flex shrink-0">
                <QRCode
                  key={`home-new-qr-${postRegisterSlot.id}`}
                  value={slotRowQrPayload(postRegisterSlot) || ' '}
                  {...POST_REGISTER_QR_PROPS}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                icon={Download}
                onClick={async () => {
                  const svgEl = postRegisterQrRef.current?.querySelector('svg');
                  if (!svgEl) {
                    toast.error('QR not ready — try again.');
                    return;
                  }
                  const ok = await downloadQrAsPng(svgEl, postRegisterSlot?.name);
                  if (ok) toast.success('QR downloaded (PNG)');
                  else toast.error('Could not create PNG — try SVG.');
                }}
              >
                PNG
              </Button>
              <Button
                variant="secondary"
                icon={Download}
                onClick={() => {
                  const svgEl = postRegisterQrRef.current?.querySelector('svg');
                  if (!svgEl) {
                    toast.error('QR not ready — try again.');
                    return;
                  }
                  if (downloadQrAsSvg(svgEl, postRegisterSlot?.name)) toast.success('QR downloaded (SVG)');
                }}
              >
                SVG
              </Button>
            </div>
            <Button fullWidth variant="success" onClick={dismissPostRegisterQr}>
              Close
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
