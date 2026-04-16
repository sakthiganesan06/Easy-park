import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { getStoredSlots } from '../data/demoSlots';
import { useLocation as useLocationCtx } from '../contexts/LocationContext';
import { haversineDistance, getDistanceText } from '../utils/geofence';
import { formatCurrency } from '../utils/formatters';
import { DURATION_OPTIONS, SLOT_STATUS } from '../utils/constants';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import {
  MapPin, Star, Clock, Car, Bike, Truck, Navigation,
  Users, Shield, ChevronRight, Zap
} from 'lucide-react';

export default function SlotDetailPage() {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const { currentLocation } = useLocationCtx();
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    const slots = getStoredSlots();
    const found = slots?.find((s) => s.id === slotId);
    if (found) {
      setSlot(found);
    } else {
      navigate('/');
    }
  }, [slotId, navigate]);

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
                <span className="text-white font-semibold text-sm">{slot.rating}</span>
              </div>
              {distance !== null && (
                <div className="flex items-center gap-1.5 text-white/50 text-sm">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{getDistanceText(distance)}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-white/50 text-sm">
                <Users className="w-3.5 h-3.5" />
                <span>{slot.totalSpots} spots</span>
              </div>
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
            {DURATION_OPTIONS.map((opt) => (
              <div
                key={opt.key}
                className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/5"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-white/30" />
                  <span className="text-sm text-white/70">{opt.label}</span>
                </div>
                <span className="text-sm font-bold text-electric-400">
                  {formatCurrency(slot.pricing[opt.key])}
                </span>
              </div>
            ))}
          </div>
        </Card>

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
