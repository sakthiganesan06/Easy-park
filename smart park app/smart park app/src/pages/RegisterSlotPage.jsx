import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../contexts/AuthContext';
import { useLocation as useLocationCtx } from '../contexts/LocationContext';
import { addSlot } from '../data/demoSlots';
import { VEHICLE_TYPES, DURATION_OPTIONS } from '../utils/constants';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import {
  MapPin, User, Phone, DollarSign, Car, Bike, Truck,
  ImagePlus, ChevronRight, ChevronLeft, Check, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const pinIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div class="marker-price available">📍 Here</div>',
  iconSize: [60, 36],
  iconAnchor: [30, 36],
});

// Map click handler component
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function RegisterSlotPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLocation } = useLocationCtx();

  const [step, setStep] = useState(1);
  const totalSteps = 4;
  const [loading, setLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    ownerName: user?.name || '',
    ownerPhone: user?.phone || '',
    location: currentLocation || { lat: 13.0827, lng: 80.2707 },
    address: '',
    pricing: {
      min20: 10,
      min30: 15,
      min40: 20,
      hr1: 30,
      hr2: 55,
      hr3: 75,
    },
    vehicleTypes: ['car', 'bike'],
    totalSpots: 5,
  });

  // Update location when available
  useEffect(() => {
    if (currentLocation && !formData.location) {
      setFormData(prev => ({ ...prev, location: currentLocation }));
    }
  }, [currentLocation]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updatePricing = (key, value) => {
    setFormData(prev => ({
      ...prev,
      pricing: { ...prev.pricing, [key]: Number(value) || 0 },
    }));
  };

  const toggleVehicle = (type) => {
    setFormData(prev => {
      const types = prev.vehicleTypes.includes(type)
        ? prev.vehicleTypes.filter(t => t !== type)
        : [...prev.vehicleTypes, type];
      return { ...prev, vehicleTypes: types };
    });
  };

  const handleSubmit = async () => {
    if (!formData.name) return toast.error('Please enter a parking name');
    if (!formData.address) return toast.error('Please enter an address');
    if (formData.vehicleTypes.length === 0) return toast.error('Select at least one vehicle type');

    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));

    const newSlot = {
      id: `slot-${Date.now()}`,
      ownerId: user?.id,
      ownerName: formData.ownerName,
      ownerPhone: formData.ownerPhone,
      name: formData.name,
      location: formData.location,
      address: formData.address,
      pricing: formData.pricing,
      vehicleTypes: formData.vehicleTypes,
      imageUrl: null,
      status: 'available',
      rating: '4.0',
      totalSpots: formData.totalSpots,
      createdAt: new Date().toISOString(),
    };

    addSlot(newSlot);
    setLoading(false);
    toast.success('Parking slot registered successfully!');
    navigate('/');
  };

  const canNext = () => {
    switch (step) {
      case 1: return formData.name && formData.ownerName;
      case 2: return formData.location && formData.address;
      case 3: return Object.values(formData.pricing).every(v => v > 0);
      case 4: return formData.vehicleTypes.length > 0;
      default: return true;
    }
  };

  const vehicleIcon = (type) => {
    switch (type) {
      case 'car': return Car;
      case 'bike': return Bike;
      default: return Truck;
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 pb-32">
      <Navbar title="Register Parking" showBack />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4 animate-fade-in">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`step-dot ${
                i + 1 < step ? 'completed' : i + 1 === step ? 'active' : 'pending'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4 animate-slide-up">
            <div className="mb-2">
              <h2 className="text-lg font-bold text-white">Basic Information</h2>
              <p className="text-sm text-white/40">Tell us about your parking space</p>
            </div>
            <Input
              label="Parking Space Name"
              icon={MapPin}
              placeholder="e.g., Green Valley Parking"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
            <Input
              label="Your Name"
              icon={User}
              placeholder="Owner name"
              value={formData.ownerName}
              onChange={(e) => updateField('ownerName', e.target.value)}
            />
            <Input
              label="Mobile Number"
              icon={Phone}
              placeholder="10-digit mobile"
              value={formData.ownerPhone}
              onChange={(e) => updateField('ownerPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            <Input
              label="Total Parking Spots"
              icon={Car}
              type="number"
              placeholder="Number of spots"
              value={formData.totalSpots}
              onChange={(e) => updateField('totalSpots', Number(e.target.value))}
              min={1}
            />
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div className="space-y-4 animate-slide-up">
            <div className="mb-2">
              <h2 className="text-lg font-bold text-white">Parking Location</h2>
              <p className="text-sm text-white/40">Tap on the map to set exact location</p>
            </div>

            <Card className="!p-0 overflow-hidden" style={{ height: '250px' }}>
              <MapContainer
                center={[formData.location.lat, formData.location.lng]}
                zoom={16}
                className="w-full h-full"
                style={{ height: '250px' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; CARTO'
                />
                <MapClickHandler onLocationSelect={(loc) => updateField('location', loc)} />
                <Marker
                  position={[formData.location.lat, formData.location.lng]}
                  icon={pinIcon}
                />
              </MapContainer>
            </Card>

            <div className="flex items-center gap-2 text-xs text-white/30">
              <MapPin className="w-3 h-3" />
              <span>
                {formData.location.lat.toFixed(5)}, {formData.location.lng.toFixed(5)}
              </span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (currentLocation) {
                  updateField('location', currentLocation);
                  toast.success('Using your current location');
                }
              }}
            >
              Use Current Location
            </Button>

            <Input
              label="Full Address"
              icon={MapPin}
              placeholder="Street, Area, City"
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
            />
          </div>
        )}

        {/* Step 3: Pricing */}
        {step === 3 && (
          <div className="space-y-4 animate-slide-up">
            <div className="mb-2">
              <h2 className="text-lg font-bold text-white">Set Pricing</h2>
              <p className="text-sm text-white/40">Set rates for each duration (in ₹)</p>
            </div>

            <div className="space-y-3">
              {DURATION_OPTIONS.map((opt) => (
                <div key={opt.key} className="flex items-center gap-3">
                  <span className="text-sm text-white/60 w-20">{opt.label}</span>
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">₹</span>
                    <input
                      type="number"
                      value={formData.pricing[opt.key]}
                      onChange={(e) => updatePricing(opt.key, e.target.value)}
                      className="input-field pl-8 text-right"
                      min={1}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Vehicle Types */}
        {step === 4 && (
          <div className="space-y-4 animate-slide-up">
            <div className="mb-2">
              <h2 className="text-lg font-bold text-white">Vehicle Types</h2>
              <p className="text-sm text-white/40">Select which vehicles are allowed</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {VEHICLE_TYPES.map((vt) => {
                const Icon = vehicleIcon(vt.id);
                const selected = formData.vehicleTypes.includes(vt.id);
                return (
                  <button
                    key={vt.id}
                    onClick={() => toggleVehicle(vt.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                      selected
                        ? 'bg-electric-500/20 border-electric-500 text-electric-400'
                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="font-medium capitalize">{vt.label}</span>
                    {selected && <Check className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-navy-900/95 backdrop-blur-xl border-t border-white/5 z-30">
          <div className="max-w-lg mx-auto flex gap-3">
            {step > 1 && (
              <Button variant="secondary" icon={ChevronLeft} onClick={() => setStep(s => s - 1)}>
                Back
              </Button>
            )}
            {step < totalSteps ? (
              <Button
                fullWidth
                icon={ChevronRight}
                disabled={!canNext()}
                onClick={() => setStep(s => s + 1)}
              >
                Next
              </Button>
            ) : (
              <Button
                fullWidth
                icon={Check}
                variant="success"
                loading={loading}
                disabled={!canNext()}
                onClick={handleSubmit}
              >
                Register Parking Slot
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
