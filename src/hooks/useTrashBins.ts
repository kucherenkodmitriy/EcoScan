import { useState, useEffect, useCallback } from 'react';
import { 
  getTrashBins, 
  getTrashBinsByLocation, 
  createTrashBin, 
  updateTrashBin, 
  deleteTrashBin, 
  updateBinStatus 
} from '../services/api';
import { TrashBin, BinStatus } from '../types';

export const useTrashBins = (locationId?: string) => {
  const [trashBins, setTrashBins] = useState<TrashBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrashBins = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      
      if (locationId) {
        data = await getTrashBinsByLocation(locationId);
      } else {
        data = await getTrashBins();
      }
      
      setTrashBins(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchTrashBins();
  }, [fetchTrashBins]);

  const addTrashBin = async (bin: Omit<TrashBin, 'id' | 'status' | 'qrCodeId' | 'lastUpdated' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      const newBin = await createTrashBin(bin);
      setTrashBins(prev => [...prev, newBin]);
      return newBin;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create trash bin'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const editTrashBin = async (id: string, binData: Partial<TrashBin>) => {
    try {
      setLoading(true);
      const updatedBin = await updateTrashBin(id, binData);
      setTrashBins(prev => 
        prev.map(bin => bin.id === id ? updatedBin : bin)
      );
      return updatedBin;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to update trash bin ${id}`));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeTrashBin = async (id: string) => {
    try {
      setLoading(true);
      await deleteTrashBin(id);
      setTrashBins(prev => prev.filter(bin => bin.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to delete trash bin ${id}`));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: BinStatus) => {
    try {
      setLoading(true);
      const updatedBin = await updateBinStatus(id, status);
      setTrashBins(prev => 
        prev.map(bin => bin.id === id ? updatedBin : bin)
      );
      return updatedBin;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to update status for bin ${id}`));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    trashBins,
    loading,
    error,
    fetchTrashBins,
    addTrashBin,
    editTrashBin,
    removeTrashBin,
    updateStatus
  };
}; 