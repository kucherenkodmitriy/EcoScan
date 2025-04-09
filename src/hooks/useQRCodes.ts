import { useState, useEffect, useCallback } from 'react';
import { getQRCodes, getQRCode, generateQRCode, deleteQRCode } from '../services/api';
import { QRCode } from '../types';

export const useQRCodes = () => {
  const [qrCodes, setQRCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchQRCodes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getQRCodes();
      setQRCodes(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQRCodes();
  }, [fetchQRCodes]);

  const getQRCodeById = async (id: string) => {
    try {
      setLoading(true);
      const qrCode = await getQRCode(id);
      return qrCode;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to get QR code ${id}`));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createQRCode = async (binId: string) => {
    try {
      setLoading(true);
      const newQRCode = await generateQRCode(binId);
      setQRCodes(prev => [...prev, newQRCode]);
      return newQRCode;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to generate QR code for bin ${binId}`));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeQRCode = async (id: string) => {
    try {
      setLoading(true);
      await deleteQRCode(id);
      setQRCodes(prev => prev.filter(qrCode => qrCode.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to delete QR code ${id}`));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    qrCodes,
    loading,
    error,
    fetchQRCodes,
    getQRCodeById,
    createQRCode,
    removeQRCode,
  };
}; 