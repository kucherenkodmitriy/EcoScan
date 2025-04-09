import { useState, useEffect, useCallback } from 'react';
import { getLocations, createLocation, updateLocation, deleteLocation } from '../services/api';
import { Location } from '../types';

export const useLocations = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLocations();
      setLocations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const addLocation = async (location: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      const newLocation = await createLocation(location);
      setLocations(prev => [...prev, newLocation]);
      return newLocation;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create location'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const editLocation = async (id: string, locationData: Partial<Location>) => {
    try {
      setLoading(true);
      const updatedLocation = await updateLocation(id, locationData);
      setLocations(prev => 
        prev.map(location => location.id === id ? updatedLocation : location)
      );
      return updatedLocation;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to update location ${id}`));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeLocation = async (id: string) => {
    try {
      setLoading(true);
      await deleteLocation(id);
      setLocations(prev => prev.filter(location => location.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to delete location ${id}`));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    locations,
    loading,
    error,
    fetchLocations,
    addLocation,
    editLocation,
    removeLocation,
  };
}; 