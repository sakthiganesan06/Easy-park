import { useState, useEffect } from 'react';
import { haversineDistance } from '../utils/geofence';

/**
 * Geo-fencing hook - checks if user is within radius of a target location
 * @param {number} targetLat - Target latitude
 * @param {number} targetLng - Target longitude
 * @param {number} radiusMeters - Acceptable radius in meters
 * @param {Object} userLocation - { lat, lng } current user position
 * @returns {{ isWithinFence, distance, distanceText }}
 */
export function useGeofence(targetLat, targetLng, radiusMeters, userLocation) {
  const [distance, setDistance] = useState(null);
  const [isWithinFence, setIsWithinFence] = useState(false);

  useEffect(() => {
    if (!userLocation || !targetLat || !targetLng) {
      setDistance(null);
      setIsWithinFence(false);
      return;
    }

    const d = haversineDistance(
      userLocation.lat,
      userLocation.lng,
      targetLat,
      targetLng
    );

    setDistance(d);
    setIsWithinFence(d <= radiusMeters);
  }, [userLocation, targetLat, targetLng, radiusMeters]);

  const distanceText = distance !== null
    ? distance < 1000
      ? `${Math.round(distance)} m away`
      : `${(distance / 1000).toFixed(1)} km away`
    : 'Calculating...';

  return { isWithinFence, distance, distanceText };
}
