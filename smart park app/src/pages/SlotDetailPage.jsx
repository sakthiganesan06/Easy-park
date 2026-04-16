import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { useLocation as useLocationCtx } from '../contexts/LocationContext';
import { BOOKING_GEOFENCE_METERS, BOOKING_STATUS } from '../utils/constants';
import { haversineDistance, getDistanceText } from '../utils/geofence';
import { formatCurrency } from '../utils/formatters';
import { calculatePrice, getPerMinuteRate } from '../utils/pricing';
import { DURATION_OPTIONS, SLOT_STATUS, LOCK_DURATION_MS } from '../utils/constants';
import { getSlotById, getSlotReviews } from '../lib/parkingApi';
import { useBooking } from '../contexts/BookingContext';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import SlotReviews, { StarDisplay } from '../components/booking/SlotReviews';
import {
  MapPin, Star, Clock, Car, Bike, Truck, Navigation,
  Users, Shield, ChevronRight, Zap
} from 'lucide-react';

export default function SlotDetailPage() {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const {
    currentLocation,
    locationGranted,
    loading: locLoading,
    requestLocation,
  } = useLocationCtx();
  const { activeBooking } = useBooking();
  const [slot, setSlot] = useState(null);
  const [reviewsData, setReviewsData] = useState({ reviews: [], averageRating: 0, totalReviews: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => {
    if (!locationGranted && !locLoading) {
      requestLocation();
    }
  }, [locationGranted, locLoading, requestLocation]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const row = await getSlotById(slotId);
        let status = row.effective_status || (row.is_available ? 'available' : 'locked');

        // Override with local activeBooking status for the user's own slot
        if (activeBooking && activeBooking.slotId === slotId) {
          switch (activeBooking.status) {
            case BOOKING_STATUS.LOCKED:
              status = SLOT_STATUS.LOCKED;
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

        const uiSlot = {
          id: row.id,
          ownerId: row.owner_id,
          ownerName: 'Owner',
          ownerPhone: row.owner_phone || '',
          name: row.name || 'Parking Slot',
          address: row.address || '',
          location: { lat: row.latitude, lng: row.longitude },
          pricing: row.pricing || {},
          vehicleTypes: row.vehicle_types || [],
          status,
          rating: '4.0',
          totalSpots: 5,
          createdAt: row.created_at,
          imageUrl: row.image_url || '',
        };
        if (!mounted) return;
        setSlot(uiSlot);
      } catch {
        navigate('/');
      }
    })();
    return () => { mounted = false; };
  }, [slotId, navigate, activeBooking]);

  // Fetch reviews
  useEffect(() => {
    let mounted = true;
    setReviewsLoading(true);
    (async () => {
      try {
        const data = await getSlotReviews(slotId);
        if (!mounted) return;
        setReviewsData(data);
      } catch (e) {
        console.error('Failed to load reviews:', e);
      }
      if (mounted) setReviewsLoading(false);
    })();
    return () => { mounted = false; };
  }, [slotId]);

  const distance = useMemo(() => {
    if (!slot || !currentLocation) return null;
    return haversineDistance(
      currentLocation.lat, currentLocation.lng,
      slot.location.lat, slot.location.lng
    );
  }, [slot, currentLocation]);

  if (!slot) return null;

  const vehicleIcon = (type) => {
    switch (type) {
      case 'car': return <Car className="w-4 h-4" />;
      case 'bike': return <Bike className="w-4 h-4" />;
      default: return <Truck className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-navy-900">
      <Navbar title="Slot Details" showBack showWallet={false} />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4 animate-fade-in pb-24">
        <Card className="!p-0 overflow-hidden">
          <img
            src={slot.imageUrl || '/slot-placeholder.svg'}
            alt={slot.name}
            className="w-full h-52 object-cover"
          />
        </Card>

        {/* Header card */}
        <Card className="relative overflow-hidden">
          {/* Decorative gradient */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-electric-500/20 to-transparent rounded-bl-full" />

          <div className="relative">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h1 className="text-xl font-bold text-white mb-1">{slot.name}</h1>
                <div className="flex items-center gap-1.5 text-white/40 text-sm">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{slot.address}</span>
                </div>
              </div>
              <Badge status={slot.status} />
            </div>

            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-400 fill-current" />
                <span className="text-white font-semibold text-sm">
                  {reviewsData.averageRating > 0 ? reviewsData.averageRating : slot.rating}
                </span>
                {reviewsData.totalReviews > 0 && (
                  <span className="text-white/30 text-xs">({reviewsData.totalReviews})</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-white/50 text-sm">
                <Users className="w-3.5 h-3.5" />
                <span>{slot.totalSpots} spots</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-white/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-electric-500/15 flex items-center justify-center shrink-0">
              <Navigation className="w-5 h-5 text-electric-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider">
                Distance from your location
              </p>
              {locLoading && !currentLocation ? (
                <p className="text-base text-white/50 mt-1">Getting your location…</p>
              ) : distance !== null ? (
                <>
                  <p className="text-xl font-bold text-white mt-0.5 tabular-nums">
                    {getDistanceText(distance)}
                  </p>
                  <p className="text-[11px] text-white/35 mt-1.5 leading-relaxed">
                    Straight-line distance from your live GPS position. It updates as you move.
                    Book when you are within {getDistanceText(BOOKING_GEOFENCE_METERS)} of the slot.
                  </p>
                </>
              ) : (
                <p className="text-base text-white/50 mt-1">Location not available yet.</p>
              )}
            </div>
          </div>
        </Card>

        {/* Owner info */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-electric-500 to-emerald-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {slot.ownerName?.charAt(0) || 'O'}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{slot.ownerName}</p>
              <p className="text-xs text-white/40">Parking Owner</p>
            </div>
            <div className="ml-auto flex items-center gap-1 text-emerald-400 text-xs">
              <Shield className="w-3.5 h-3.5" />
              Verified
            </div>
          </div>
        </Card>

        {/* Vehicle types */}
        <Card>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
            Allowed Vehicles
          </h3>
          <div className="flex gap-3">
            {slot.vehicleTypes.map((type) => (
              <div
                key={type}
                className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2.5 border border-white/10"
              >
                <span className="text-electric-400">{vehicleIcon(type)}</span>
                <span className="text-sm text-white capitalize">{type}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Pricing table */}
        <Card>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
            Pricing
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {DURATION_OPTIONS.map((opt) => {
              const explicitPrice = slot.pricing[opt.key];
              const fallbackPrice = Math.max(1, Math.round(getPerMinuteRate(slot.pricing) * opt.minutes));
              const displayPrice = explicitPrice ?? fallbackPrice;
              return (
                <div
                  key={opt.key}
                  className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/5"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-sm text-white/70">{opt.label}</span>
                  </div>
                  <span className="text-sm font-bold text-electric-400">
                    {formatCurrency(displayPrice)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {slot.status === SLOT_STATUS.AVAILABLE && (
          <Card className="!py-3 border-electric-500/15 bg-electric-500/5">
            <p className="text-xs text-white/45 leading-relaxed">
              You can book and pay in the app. <span className="text-white/70">After payment</span>, scan the QR displayed at
              this slot to start your session — the parking timer runs only after that scan matches your booking.
            </p>
          </Card>
        )}

        {slot.status === SLOT_STATUS.LOCKED && (
          <Card className="!py-3 border-yellow-500/20 bg-yellow-500/5">
            <p className="text-xs text-yellow-300/80 leading-relaxed">
              🔒 This slot is currently <span className="font-semibold text-yellow-400">locked</span> by another user who is heading to the parking location. It will become available again if the lock expires.
            </p>
          </Card>
        )}

        {slot.status === SLOT_STATUS.BOOKING && (
          <Card className="!py-3 border-violet-500/20 bg-violet-500/5">
            <p className="text-xs text-violet-300/80 leading-relaxed">
              ⏳ This slot is currently in the <span className="font-semibold text-violet-400">booking</span> process — another user has arrived and is completing payment. It will free up if payment isn't completed in time.
            </p>
          </Card>
        )}

        {slot.status === SLOT_STATUS.BOOKED && (
          <Card className="!py-3 border-red-500/20 bg-red-500/5">
            <p className="text-xs text-red-300/80 leading-relaxed">
              🚗 This slot is <span className="font-semibold text-red-400">booked</span> — another user has paid and is using this parking spot. Check back later when it becomes available.
            </p>
          </Card>
        )}

        {/* Reviews & Ratings section */}
        <SlotReviews
          reviews={reviewsData.reviews}
          averageRating={reviewsData.averageRating}
          totalReviews={reviewsData.totalReviews}
          loading={reviewsLoading}
        />

        {/* Book Now button */}
        {slot.status === SLOT_STATUS.AVAILABLE && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-navy-900/95 backdrop-blur-xl border-t border-white/5 z-30">
            <div className="max-w-lg mx-auto flex items-center gap-4">
              <div>
                <p className="text-xs text-white/40">Starting from</p>
                <p className="text-xl font-bold text-electric-400">
                  {formatCurrency(slot.pricing.min20)}
                </p>
              </div>
              <Button
                fullWidth
                icon={Zap}
                onClick={() => navigate(`/book/${slot.id}`)}
              >
                Book Now
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
