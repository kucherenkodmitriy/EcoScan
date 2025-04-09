import { useState, useContext, useCallback } from 'react';
import { MapContext } from '../context/MapContext';

interface UseMapLocationResult {
  address: string;
  latitude: number;
  longitude: number;
  isLoading: boolean;
  error: Error | null;
  setAddress: (address: string) => void;
  searchAddress: () => Promise<void>;
  handleMapClick: (lat: number, lng: number) => Promise<void>;
  resetLocation: () => void;
}

export const useMapLocation = (initialAddress: string = '', initialLat: number = 0, initialLng: number = 0): UseMapLocationResult => {
  const [address, setAddress] = useState(initialAddress);
  const [latitude, setLatitude] = useState(initialLat);
  const [longitude, setLongitude] = useState(initialLng);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { isLoaded, geocode, reverseGeocode } = useContext(MapContext);

  const searchAddress = useCallback(async () => {
    if (!address || !isLoaded) return;

    setIsLoading(true);
    setError(null);

    try {
      const coordinates = await geocode(address);
      setLatitude(coordinates.lat);
      setLongitude(coordinates.lng);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to geocode address'));
    } finally {
      setIsLoading(false);
    }
  }, [address, geocode, isLoaded]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (!isLoaded) return;

    setIsLoading(true);
    setError(null);

    try {
      const formattedAddress = await reverseGeocode(lat, lng);
      setAddress(formattedAddress);
      setLatitude(lat);
      setLongitude(lng);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to reverse geocode location'));
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, reverseGeocode]);

  const resetLocation = useCallback(() => {
    setAddress('');
    setLatitude(0);
    setLongitude(0);
    setError(null);
  }, []);

  return {
    address,
    latitude,
    longitude,
    isLoading,
    error,
    setAddress,
    searchAddress,
    handleMapClick,
    resetLocation,
  };
}; 