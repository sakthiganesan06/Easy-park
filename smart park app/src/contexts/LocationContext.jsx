import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DEFAULT_LOCATION } from '../utils/constants';

const LocationContext = createContext(null);

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
}

export function LocationProvider({ children }) {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [watchId, setWatchId] = useState(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setLoading(false);
      // Fallback to default location
      setCurrentLocation(DEFAULT_LOCATION);
      return;
    }

    setLoading(true);
    setLocationError(null);

    // First get current position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentLocation(loc);
        setLocationGranted(true);
        setLoading(false);
      },
      (error) => {
        console.error('Location error:', error);
        setLocationError(
          error.code === 1
            ? 'Location access denied. Please enable location permissions.'
            : 'Unable to get your location. Using default location.'
        );
        setCurrentLocation(DEFAULT_LOCATION);
        setLocationGranted(true); // Allow proceeding with default
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );

    // Then watch for updates
    const id = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {}, // Silently ignore watch errors
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
    setWatchId(id);
  }, []);

  // Cleanup watcher
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const value = {
    currentLocation,
    locationGranted,
    locationError,
    loading,
    requestLocation,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}
