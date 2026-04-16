import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { QRCode } from 'react-qr-code';
import { useAuth } from '../contexts/AuthContext';
import { useLocation as useLocationCtx } from '../contexts/LocationContext';
import {
  createParkingSlot,
  getSlotsByOwner,
  subscribeToSlots,
  uploadParkingSlotImage,
} from '../lib/parkingApi';
import { slotRowQrPayload } from '../utils/qr';
import { downloadQrAsPng, downloadQrAsSvg } from '../utils/qrDownload';
import { VEHICLE_TYPES, DURATION_OPTIONS } from '../utils/constants';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import {
  MapPin, User, Phone, DollarSign, Car, Bike, Truck,
  ImagePlus, ChevronRight, ChevronLeft, Check, ArrowRight, PlusCircle, RefreshCw, Download
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

  const [mode, setMode] = useState('list'); // 'list' | 'create'
  const [mySlots, setMySlots] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedQrSlot, setSelectedQrSlot] = useState(null);
  const qrContainerRef = useRef(null);
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
    imageFile: null,
    imagePreview: '',
  });

  // Update location when available
  useEffect(() => {
    if (currentLocation && !formData.location) {
      setFormData(prev => ({ ...prev, location: currentLocation }));
    }
  }, [currentLocation]);

  const loadMySlots = async () => {
    if (!user?.id) return;
    setListLoading(true);
    try {
      const rows = await getSlotsByOwner(user.id);
      setMySlots(rows);
    } catch (e) {
      toast.error(e?.message || 'Failed to load your slots');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadMySlots();
    // realtime refresh for this owner's slots
    const unsub = subscribeToSlots((payload) => {
      const row = payload?.new || payload?.old;
      if (row?.owner_id === user?.id) loadMySlots();
    });
    return unsub;
  }, [user?.id]);

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
    try {
      const qrToken = crypto.randomUUID();
      let imageUrl = null;
      if (formData.imageFile) {
        imageUrl = await uploadParkingSlotImage(user?.id, formData.imageFile);
        if (!imageUrl) {
          toast(
            'Slot saved without photo — create the Storage bucket "slot-images" in Supabase (see docs/supabase_migration_slot_images_qr.sql) to enable image upload.',
            { duration: 6000, icon: 'ℹ️' }
          );
        }
      }

      const created = await createParkingSlot({
        ownerId: user?.id,
        name: formData.name,
        address: formData.address,
        ownerPhone: formData.ownerPhone,
        latitude: formData.location.lat,
        longitude: formData.location.lng,
        pricing: formData.pricing,
        vehicleTypes: formData.vehicleTypes,
        imageUrl,
        qrToken,
      });
      const postReg = {
        id: created.id,
        name: created.name,
        qr_token: created.qr_token ?? null,
      };
      try {
        sessionStorage.setItem('easypark_post_register_slot', JSON.stringify(postReg));
      } catch {
        /* ignore quota / private mode */
      }
      toast.success('Slot saved — use this QR at the entrance. Drivers must scan it to book.');
      // Defer route change so Leaflet (register wizard) can unmount cleanly; avoid router state quirks.
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 0);
    } catch (e) {
      toast.error(e?.message || 'Failed to register slot');
    } finally {
      setLoading(false);
    }
  };

  const getQrSvgEl = () => qrContainerRef.current?.querySelector('svg');

  const activeQrLabel = selectedQrSlot?.name;

  const handleDownloadQrSvg = () => {
    const svgEl = getQrSvgEl();
    if (!svgEl) {
      toast.error('QR not ready yet — try opening the dialog again.');
      return;
    }
    if (downloadQrAsSvg(svgEl, activeQrLabel)) {
      toast.success('QR downloaded (SVG)');
    }
  };

  const handleDownloadQrPng = async () => {
    const svgEl = getQrSvgEl();
    if (!svgEl) {
      toast.error('QR not ready yet — try opening the dialog again.');
      return;
    }
    const ok = await downloadQrAsPng(svgEl, activeQrLabel);
    if (ok) toast.success('QR downloaded (PNG)');
    else toast.error('Could not create PNG — try SVG download.');
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

  const qrCodeProps = {
    size: 220,
    level: 'M',
    fgColor: '#000000',
    bgColor: '#FFFFFF',
  };

  if (mode === 'list') {
    return (
      <>
      <div className="min-h-screen bg-navy-900 pb-32">
        <Navbar title="My Parking Slots" showBack />

        <div className="px-4 py-4 max-w-lg mx-auto space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <Button
              icon={PlusCircle}
              onClick={() => setMode('create')}
            >
              Register New
            </Button>
            <button
              onClick={loadMySlots}
              className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-white/40 ${listLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {listLoading ? (
            <Card>
              <p className="text-sm text-white/50">Loading your slots...</p>
            </Card>
          ) : mySlots.length === 0 ? (
            <Card className="text-center">
              <MapPin className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-white/70 font-semibold">No slots registered yet</p>
              <p className="text-white/30 text-sm mt-1">Register your first parking slot to see it here.</p>
              <div className="mt-4">
                <Button icon={PlusCircle} onClick={() => setMode('create')}>
                  Register Slot
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {mySlots.map((s) => (
                <Card key={s.id} hover className="!p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{s.name || 'Parking Slot'}</p>
                      <p className="text-xs text-white/40 truncate">{s.address || '-'}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-white/40">
                        <span className={`px-2 py-0.5 rounded-full border ${
                          s.is_available
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}>
                          {s.is_available ? 'available' : 'locked'}
                        </span>
                        <span className="text-white/20">•</span>
                        <span>{(s.vehicle_types || []).join(', ') || '—'}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-electric-400">₹{s.pricing?.min20 ?? '-'}</p>
                      <p className="text-[10px] text-white/30">per 20 min</p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="secondary" onClick={() => setSelectedQrSlot(s)}>
                      View Slot QR
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Modal
          isOpen={!!selectedQrSlot}
          onClose={() => setSelectedQrSlot(null)}
          title={selectedQrSlot ? `${selectedQrSlot.name || 'Parking Slot'} QR` : 'Slot QR'}
        >
          {selectedQrSlot && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 flex justify-center items-center min-h-[240px] w-full [&_svg]:!block [&_svg]:!max-w-none [&_svg]:!h-auto">
                <div ref={qrContainerRef} className="inline-flex shrink-0">
                  <QRCode
                    key={`list-qr-${selectedQrSlot.id}`}
                    value={slotRowQrPayload(selectedQrSlot) || ' '}
                    {...qrCodeProps}
                  />
                </div>
              </div>
              {!selectedQrSlot.qr_token && !selectedQrSlot.qrToken && (
                <p className="text-xs text-amber-400/90">
                  This slot has no QR token in the database. Run docs/supabase_migration_slot_images_qr.sql
                  and re-save the slot, or register a new slot.
                </p>
              )}
              <p className="text-xs text-white/40 break-all">
                Slot ID: {selectedQrSlot.id}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" icon={Download} onClick={handleDownloadQrPng}>
                  PNG
                </Button>
                <Button variant="secondary" icon={Download} onClick={handleDownloadQrSvg}>
                  SVG
                </Button>
              </div>
              <p className="text-[10px] text-white/30 text-center">
                Use PNG for printing; SVG for sharp scaling.
              </p>
            </div>
          )}
        </Modal>
      </div>
      </>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-navy-900 pb-32">
      <Navbar title="Register Parking" showBack />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMode('list')}
            className="text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            ← Back to My Slots
          </button>
        </div>

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

            <div>
              <label className="block text-sm text-white/60 mb-2">Parking Image (optional)</label>
              <label className="w-full border border-dashed border-white/20 rounded-xl p-4 flex items-center justify-center gap-2 text-white/60 cursor-pointer hover:bg-white/5 transition-colors">
                <ImagePlus className="w-4 h-4" />
                <span className="text-sm">{formData.imageFile ? 'Change image' : 'Upload / Capture image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const preview = URL.createObjectURL(file);
                    setFormData((prev) => ({ ...prev, imageFile: file, imagePreview: preview }));
                  }}
                />
              </label>
              {formData.imagePreview && (
                <img
                  src={formData.imagePreview}
                  alt="Slot preview"
                  className="mt-3 w-full h-40 object-cover rounded-xl border border-white/10"
                />
              )}
            </div>
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
    </>
  );
}
