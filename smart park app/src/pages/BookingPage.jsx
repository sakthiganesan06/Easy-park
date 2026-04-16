import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBooking } from '../contexts/BookingContext';
import { getSlotById } from '../lib/parkingApi';
import { calculatePrice } from '../utils/pricing';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DurationSelector from '../components/booking/DurationSelector';
import PriceSummary from '../components/booking/PriceSummary';
import { Lock, Car, Bike, Truck, MapPin, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BookingPage() {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lockSlot } = useBooking();

  const [slot, setSlot] = useState(null);
  const [selectedDurations, setSelectedDurations] = useState([]);
  const [vehicleType, setVehicleType] = useState('car');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const row = await getSlotById(slotId);
        const uiSlot = {
          id: row.id,
          ownerId: row.owner_id,
          ownerName: user?.name || 'Owner',
          ownerPhone: row.owner_phone || '',
          name: row.name || 'Parking Slot',
          address: row.address || '',
          location: { lat: row.latitude, lng: row.longitude },
          pricing: row.pricing || {},
          vehicleTypes: row.vehicle_types || [],
          status: row.is_available ? 'available' : 'locked',
          rating: '4.0',
          totalSpots: 5,
          createdAt: row.created_at,
          qrToken: row.qr_token || null,
        };
        if (!mounted) return;
        setSlot(uiSlot);
        if (uiSlot.vehicleTypes?.length) setVehicleType(uiSlot.vehicleTypes[0]);
      } catch {
        navigate('/');
      }
    })();
    return () => { mounted = false; };
  }, [slotId, navigate, user?.name]);

  const toggleDuration = (key) => {
    setSelectedDurations((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
    );
  };

  const { totalMinutes, totalPrice, breakdown } = slot
    ? calculatePrice(slot.pricing, selectedDurations)
    : { totalMinutes: 0, totalPrice: 0, breakdown: [] };

  const handleLockSlot = async () => {
    if (selectedDurations.length === 0) {
      return toast.error('Please select a duration');
    }

    setLoading(true);
    try {
      await lockSlot(slot, totalMinutes, totalPrice, vehicleType, user.id, user.name);
      toast.success('Slot locked! Head to the parking location.');
      navigate('/lock');
    } catch (e) {
      toast.error(e?.message || 'Failed to lock slot');
    } finally {
      setLoading(false);
    }
  };

  const vehicleIcon = (type) => {
    switch (type) {
      case 'car': return Car;
      case 'bike': return Bike;
      default: return Truck;
    }
  };

  if (!slot) return null;

  return (
    <div className="min-h-screen bg-navy-900 pb-32">
      <Navbar title="Book Parking" showBack />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4 animate-fade-in">
        <Card className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-electric-500/20 to-electric-500/5 border border-electric-500/20 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-electric-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{slot.name}</h2>
            <p className="text-xs text-white/40 truncate">{slot.address}</p>
          </div>
        </Card>

        <Card className="!py-3 border-white/10 bg-white/[0.03]">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-electric-400 shrink-0 mt-0.5" />
            <p className="text-xs text-white/45 leading-relaxed">
              After you pay, you will scan the <span className="text-white/70">QR at this parking slot</span> to
              start your session. The parking timer begins only when that scan matches your booking.
            </p>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
            Select Duration
          </h3>
          <p className="text-xs text-white/30 mb-4">
            You can combine multiple durations (e.g., 1 hour + 20 minutes)
          </p>
          <DurationSelector
            selectedKeys={selectedDurations}
            onToggle={toggleDuration}
          />
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
            Vehicle Type
          </h3>
          <div className="flex gap-2">
            {slot.vehicleTypes.map((type) => {
              const Icon = vehicleIcon(type);
              const selected = vehicleType === type;
              return (
                <button
                  key={type}
                  onClick={() => setVehicleType(type)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                    selected
                      ? 'bg-electric-500/20 border-electric-500 text-electric-400'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium capitalize">{type}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <PriceSummary
          breakdown={breakdown}
          totalPrice={totalPrice}
          totalMinutes={totalMinutes}
        />

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-navy-900/95 backdrop-blur-xl border-t border-white/5 z-30">
          <div className="max-w-lg mx-auto">
            <Button
              fullWidth
              size="lg"
              icon={Lock}
              loading={loading}
              disabled={selectedDurations.length === 0}
              onClick={handleLockSlot}
            >
              Lock Slot — {totalPrice > 0 ? `₹${totalPrice}` : 'Select Duration'}
            </Button>
            <p className="text-center text-xs text-white/30 mt-2">
              You&apos;ll have 10 minutes to reach the parking location
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
