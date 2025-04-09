import { API } from '@aws-amplify/api';
import { Location, TrashBin, QRCode, BinStatus, StatusUpdate } from '../types';

// Location API
export const getLocations = async (): Promise<Location[]> => {
  try {
    return await API.get('ecoscanAPI', '/locations', {});
  } catch (error) {
    console.error('Error fetching locations:', error);
    throw error;
  }
};

export const getLocation = async (id: string): Promise<Location> => {
  try {
    return await API.get('ecoscanAPI', `/locations/${id}`, {});
  } catch (error) {
    console.error(`Error fetching location ${id}:`, error);
    throw error;
  }
};

export const createLocation = async (location: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>): Promise<Location> => {
  try {
    return await API.post('ecoscanAPI', '/locations', { 
      body: location 
    });
  } catch (error) {
    console.error('Error creating location:', error);
    throw error;
  }
};

export const updateLocation = async (id: string, location: Partial<Location>): Promise<Location> => {
  try {
    return await API.put('ecoscanAPI', `/locations/${id}`, { 
      body: location 
    });
  } catch (error) {
    console.error(`Error updating location ${id}:`, error);
    throw error;
  }
};

export const deleteLocation = async (id: string): Promise<void> => {
  try {
    await API.del('ecoscanAPI', `/locations/${id}`, {});
  } catch (error) {
    console.error(`Error deleting location ${id}:`, error);
    throw error;
  }
};

// Trash Bin API
export const getTrashBins = async (): Promise<TrashBin[]> => {
  try {
    return await API.get('ecoscanAPI', '/bins', {});
  } catch (error) {
    console.error('Error fetching trash bins:', error);
    throw error;
  }
};

export const getTrashBin = async (id: string): Promise<TrashBin> => {
  try {
    return await API.get('ecoscanAPI', `/bins/${id}`, {});
  } catch (error) {
    console.error(`Error fetching trash bin ${id}:`, error);
    throw error;
  }
};

export const getTrashBinsByLocation = async (locationId: string): Promise<TrashBin[]> => {
  try {
    return await API.get('ecoscanAPI', '/bins', {
      queryStringParameters: { locationId }
    });
  } catch (error) {
    console.error(`Error fetching trash bins for location ${locationId}:`, error);
    throw error;
  }
};

export const createTrashBin = async (bin: Omit<TrashBin, 'id' | 'status' | 'qrCodeId' | 'lastUpdated' | 'createdAt' | 'updatedAt'>): Promise<TrashBin> => {
  try {
    return await API.post('ecoscanAPI', '/bins', { 
      body: bin 
    });
  } catch (error) {
    console.error('Error creating trash bin:', error);
    throw error;
  }
};

export const updateTrashBin = async (id: string, bin: Partial<TrashBin>): Promise<TrashBin> => {
  try {
    return await API.put('ecoscanAPI', `/bins/${id}`, { 
      body: bin 
    });
  } catch (error) {
    console.error(`Error updating trash bin ${id}:`, error);
    throw error;
  }
};

export const deleteTrashBin = async (id: string): Promise<void> => {
  try {
    await API.del('ecoscanAPI', `/bins/${id}`, {});
  } catch (error) {
    console.error(`Error deleting trash bin ${id}:`, error);
    throw error;
  }
};

export const updateBinStatus = async (id: string, status: BinStatus): Promise<TrashBin> => {
  try {
    return await API.put('ecoscanAPI', `/bins/${id}/status`, { 
      body: { status } 
    });
  } catch (error) {
    console.error(`Error updating status for bin ${id}:`, error);
    throw error;
  }
};

// QR Code API
export const getQRCodes = async (): Promise<QRCode[]> => {
  try {
    return await API.get('ecoscanAPI', '/qrcodes', {});
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    throw error;
  }
};

export const getQRCode = async (id: string): Promise<QRCode> => {
  try {
    return await API.get('ecoscanAPI', `/qrcodes/${id}`, {});
  } catch (error) {
    console.error(`Error fetching QR code ${id}:`, error);
    throw error;
  }
};

export const generateQRCode = async (binId: string): Promise<QRCode> => {
  try {
    return await API.post('ecoscanAPI', '/qrcodes', { 
      body: { binId } 
    });
  } catch (error) {
    console.error(`Error generating QR code for bin ${binId}:`, error);
    throw error;
  }
};

export const deleteQRCode = async (id: string): Promise<void> => {
  try {
    await API.del('ecoscanAPI', `/qrcodes/${id}`, {});
  } catch (error) {
    console.error(`Error deleting QR code ${id}:`, error);
    throw error;
  }
};

// Status Updates API
export const getStatusUpdates = async (binId: string): Promise<StatusUpdate[]> => {
  try {
    return await API.get('ecoscanAPI', '/status-updates', {
      queryStringParameters: { binId }
    });
  } catch (error) {
    console.error(`Error fetching status updates for bin ${binId}:`, error);
    throw error;
  }
}; 