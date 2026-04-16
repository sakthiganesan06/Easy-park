import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useBooking } from '../contexts/BookingContext';
import { useLocation as useLocationCtx } from '../contexts/LocationContext';
import { useCountdown } from '../hooks/useCountdown';
import { useGeofence } from '../hooks/useGeofence';
import { LOCK_DURATION_MS, GEOFENCE_RADIUS_M } from '../utils/constants';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import SessionTimer from '../components/booking/SessionTimer';
import {
  MapPin, Navigation, AlertTriangle, CheckCircle2, X,
  ArrowRight, LocateFixed
} from 'lucide-react';
import toast from 'react-hot-toast';

// Markers
const userIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div class="user-marker"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const slotIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div class="marker-price locked">📍 Slot</div>',
  iconSize: [60, 36],
  iconAnchor: [30, 36],
});

export default function LockPage() {
  const navigate = useNavigate();
  const { activeBooking, confirmArrival, cancelBooking } = useBooking();
  const { currentLocation } = useLocationCtx();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Calculate remaining lock time
  const lockedAt = activeBooking?.lockedAt ? new Date(activeBooking.lockedAt).getTime() : Date.now();
  const elapsed = Date.now() - lockedAt;
  const remaining = Math.max(LOCK_DURATION_MS - elapsed, 0);

  const { formatted, timeLeftSec, isExpired, minutes, seconds, start } = useCountdown(
    remaining,
    true,
    () => {
      toast.error('Time expired! Slot has been released.');
      void (async () => {
        await cancelBooking();
        navigate('/');
      })();
    }
  );

  // Geo-fence check
  const { isWithinFence, distance, distanceText } = useGeofence(
    activeBooking?.slotLocation?.lat,
    activeBooking?.slotLocation?.lng,
    GEOFENCE_RADIUS_M,
    currentLocation
  );

  // Redirect if no booking or already past locked state
  useEffect(() => {
    if (!activeBooking) {
      navigate('/');
      return;
    }
    if (activeBooking.status === 'arrived' || activeBooking.status === 'paid') {
      navigate('/payment');
    } else if (activeBooking.status === 'active') {
      navigate('/session');
    }
  }, [activeBooking, navigate]);

  const handleConfirmArrival = async () => {
    if (!isWithinFence) {
      toast.error('You are not close enough to the parking location');
      return;
    }
    try {
      await confirmArrival();
      toast.success('Arrival confirmed! Proceed to payment.');
      navigate('/payment');
    } catch (e) {
      toast.error(e?.message || 'Failed to confirm arrival');
    }
  };

  const handleCancel = () => {
    void (async () => {
      await cancelBooking();
      toast('Booking cancelled', { icon: '❌' });
      navigate('/');
    })();
  };

  // For demo: allow override
  const handleForceArrive = async () => {
    try {
      await confirmArrival();
      toast.success('Arrival confirmed (demo override)!');
      navigate('/payment');
    } catch (e) {
      toast.error(e?.message || 'Failed to confirm arrival');
    }
  };

  if (!activeBooking) return null;

  const slotLat = activeBooking.slotLocation?.lat || 0;
  const slotLng = activeBooking.slotLocation?.lng || 0;
  const userLat = currentLocation?.lat || slotLat;
  const userLng = currentLocation?.lng || slotLng;

  return (
    <div className="min-h-screen bg-navy-900">
      <Navbar
        title="Reach Parking"
        showBack
        showWallet
        onBack={() => navigate('/')}
      />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4 animate-fade-in">
        {/* Timer */}
        <div className="flex flex-col items-center py-4">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-4">
            Time to reach parking
          </p>
          <SessionTimer
            timeLeftSec={timeLeftSec}
            totalSec={600}
            formatted={formatted}
            isWarning={timeLeftSec <= 120}
            size={180}
          />
        </div>

        {/* Status card */}
        <Card className={`${isWithinFence ? 'border-emerald-500/30' : 'border-amber-500/20'}`}>
          <div className="flex items-center gap-3">
            {isWithinFence ? (
              <>
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-400">You've arrived!</p>
                  <p className="text-xs text-white/40">You're within the parking area</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                  <Navigation className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-400">{distanceText}</p>
                  <p className="text-xs text-white/40">Head to {activeBooking.slotName}</p>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Mini map */}
        <Card className="!p-0 overflow-hidden rounded-2xl" style={{ height: '200px' }}>
          <MapContainer
            center={[slotLat, slotLng]}
            zoom={15}
            className="w-full h-full"
            style={{ height: '200px' }}
            zoomControl={false}
            dragging={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; CARTO'
            />
            {/* Geofence circle */}
            <Circle
              center={[slotLat, slotLng]}
              radius={GEOFENCE_RADIUS_M}
              pathOptions={{
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
            {/* Route line */}
            <Polyline
              positions={[[userLat, userLng], [slotLat, slotLng]]}
              pathOptions={{ color: '#3b82f6', weight: 3, dashArray: '8 6' }}
            />
            {/* User */}
            <Marker position={[userLat, userLng]} icon={userIcon} />
            {/* Slot */}
            <Marker position={[slotLat, slotLng]} icon={slotIcon} />
          </MapContainer>
        </Card>

        {/* Booking info */}
        <Card>
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-electric-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">{activeBooking.slotName}</p>
              <p className="text-xs text-white/40">{activeBooking.slotAddress}</p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          {isWithinFence ? (
            <Button fullWidth icon={ArrowRight} variant="success" onClick={handleConfirmArrival}>
              Confirm Arrival & Pay
            </Button>
          ) : (
            <Button fullWidth icon={ArrowRight} onClick={handleForceArrive}>
              Confirm Arrival (Demo)
            </Button>
          )}

          {showCancelConfirm ? (
            <div className="flex gap-2">
              <Button fullWidth variant="danger" onClick={handleCancel}>
                Yes, Cancel
              </Button>
              <Button fullWidth variant="secondary" onClick={() => setShowCancelConfirm(false)}>
                No, Keep
              </Button>
            </div>
          ) : (
            <Button
              fullWidth
              variant="ghost"
              icon={X}
              onClick={() => setShowCancelConfirm(true)}
              className="text-white/40"
            >
              Cancel Booking
            </Button>
          )}
        </div>

        {/* Warning */}
        {timeLeftSec <= 120 && timeLeftSec > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2 animate-slide-up">
            <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-rose-300">
              Less than 2 minutes remaining! Hurry to the parking location or the slot will be released.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
