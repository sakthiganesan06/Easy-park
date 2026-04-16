import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useLocation as useLocationCtx } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import { useBooking } from '../contexts/BookingContext';
import { initializeDemoData, getStoredSlots } from '../data/demoSlots';
import { haversineDistance, getDistanceText } from '../utils/geofence';
import { formatCurrency } from '../utils/formatters';
import { SEARCH_RADIUS_KM, DEFAULT_MAP_ZOOM, SLOT_STATUS } from '../utils/constants';
import Navbar from '../components/layout/Navbar';
import BottomNav from '../components/layout/BottomNav';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  MapPin, Navigation, Star, Car, Bike, Truck, ChevronUp,
  ChevronDown, Search, PlusCircle, AlertCircle, LocateFixed,
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

export default function HomePage() {
  const navigate = useNavigate();
  const { currentLocation, locationGranted, locationError, loading: locLoading, requestLocation } = useLocationCtx();
  const { user } = useAuth();
  const { hasActiveBooking, activeBooking } = useBooking();

  const [slots, setSlots] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Request location on mount
  useEffect(() => {
    if (!locationGranted && !locLoading) {
      requestLocation();
    }
  }, [locationGranted, locLoading, requestLocation]);

  // Load/seed demo slots when location is available
  useEffect(() => {
    if (currentLocation) {
      const data = initializeDemoData(currentLocation.lat, currentLocation.lng);
      setSlots(data);
    }
  }, [currentLocation]);

  // Refresh slots periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const data = getStoredSlots();
      if (data) setSlots(data);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Redirect to active session if there's one
  useEffect(() => {
    if (hasActiveBooking && activeBooking) {
      if (activeBooking.status === 'active') {
        navigate('/session');
      } else if (activeBooking.status === 'locked') {
        navigate('/lock');
      } else if (activeBooking.status === 'arrived' || activeBooking.status === 'paid') {
        navigate('/payment');
      }
    }
  }, [hasActiveBooking, activeBooking, navigate]);

  // Sorted slots by distance
  const sortedSlots = useMemo(() => {
    if (!currentLocation || !slots.length) return [];
    return slots
      .map((slot) => ({
        ...slot,
        distance: haversineDistance(
          currentLocation.lat, currentLocation.lng,
          slot.location.lat, slot.location.lng
        ),
      }))
      .filter((s) => s.distance <= SEARCH_RADIUS_KM * 1000)
      .sort((a, b) => a.distance - b.distance);
  }, [slots, currentLocation]);

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
    <div className="min-h-screen bg-navy-900 flex flex-col">
      <Navbar />

      {/* Map */}
      <div className="relative flex-1" style={{ minHeight: '60vh' }}>
        <MapContainer
          center={[currentLocation.lat, currentLocation.lng]}
          zoom={DEFAULT_MAP_ZOOM}
          className="w-full h-full"
          style={{ height: '60vh' }}
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
                  if (slot.status === SLOT_STATUS.AVAILABLE) {
                    navigate(`/slot/${slot.id}`);
                  } else {
                    toast.error(`This slot is ${slot.status}`);
                  }
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
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
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
          className="absolute bottom-4 right-4 z-[1000] flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold px-4 py-3 rounded-2xl shadow-glow-emerald hover:shadow-lg transition-all active:scale-95"
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-sm">Register Slot</span>
        </button>
      </div>

      {/* Bottom sheet */}
      <div
        className={`bottom-sheet ${sheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-140px)]'}`}
        style={{ maxHeight: '55vh' }}
      >
        {/* Handle */}
        <button
          onClick={() => setSheetOpen(!sheetOpen)}
          className="w-full flex flex-col items-center pt-3 pb-2"
        >
          <div className="w-10 h-1 bg-white/20 rounded-full mb-2" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white/50">
              <span className="text-emerald-400 font-bold">{availableCount}</span> spots available nearby
            </span>
            {sheetOpen ? (
              <ChevronDown className="w-4 h-4 text-white/30" />
            ) : (
              <ChevronUp className="w-4 h-4 text-white/30" />
            )}
          </div>
        </button>

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
        <div className="px-4 pb-24 overflow-y-auto" style={{ maxHeight: 'calc(55vh - 120px)' }}>
          <div className="space-y-3">
            {filteredSlots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => {
                  if (slot.status === SLOT_STATUS.AVAILABLE) {
                    navigate(`/slot/${slot.id}`);
                  } else {
                    toast.error(`This slot is currently ${slot.status}`);
                  }
                }}
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

      <BottomNav />
    </div>
  );
}
