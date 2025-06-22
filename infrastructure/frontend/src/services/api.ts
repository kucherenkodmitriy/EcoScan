import { get, post, del } from "@aws-amplify/api";
import { fetchAuthSession } from "aws-amplify/auth";

// API Configuration
const API_BASE_URL =
  import.meta.env.VITE_API_ENDPOINT || "https://api.ecoscan.example.com";

// Types
export interface BinStatusRequest {
  status: {
    value: number;
  };
}

export interface BinStatusResponse {
  success: boolean;
  message: string;
  updated_at: string;
}

export interface TrashBin {
  binId: string;
  name: string;
  status: number;
  lastUpdated: string;
  reportsCount: number;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

export interface StatusReport {
  binId: string;
  createdAt: string;
  status: number;
}

export interface CreateBinRequest {
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

export interface BinStatus {
  binId: string;
  name: string;
  status: number;
  lastUpdated: string;
  reportsCount: number;
}

export interface UpdateStatusRequest {
  binId: string;
  status: number;
}

class ApiService {
  private apiName = "ecoscanAPI";

  // Get all bins
  async getBins(): Promise<BinStatus[]> {
    try {
      const restOperation = get({
        apiName: this.apiName,
        path: "/bins",
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return (data as any)?.bins || [];
    } catch (error) {
      console.error("Error fetching bins:", error);
      throw error;
    }
  }

  // Get bin by ID
  async getBin(binId: string): Promise<BinStatus> {
    try {
      const restOperation = get({
        apiName: this.apiName,
        path: `/bins/${binId}`,
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return data as unknown as BinStatus;
    } catch (error) {
      console.error("Error fetching bin:", error);
      throw error;
    }
  }

  // Update bin status
  async updateBinStatus(binId: string, status: number): Promise<BinStatus> {
    try {
      const restOperation = post({
        apiName: this.apiName,
        path: "/bins/status",
        options: {
          body: {
            binId,
            status,
          },
        },
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return data as unknown as BinStatus;
    } catch (error) {
      console.error("Error updating bin status:", error);
      throw error;
    }
  }

  // Get status reports for a bin
  async getBinReports(binId: string): Promise<StatusReport[]> {
    try {
      const restOperation = get({
        apiName: this.apiName,
        path: `/bins/${binId}/reports`,
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return (data as any)?.reports || [];
    } catch (error) {
      console.error("Error fetching bin reports:", error);
      throw error;
    }
  }

  // Create new bin (admin only)
  async createBin(name: string): Promise<BinStatus> {
    try {
      const restOperation = post({
        apiName: this.apiName,
        path: "/bins",
        options: {
          body: { name },
        },
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return data as unknown as BinStatus;
    } catch (error) {
      console.error("Error creating bin:", error);
      throw error;
    }
  }

  // Delete bin (admin only)
  async deleteBin(binId: string): Promise<void> {
    try {
      const restOperation = del({
        apiName: this.apiName,
        path: `/bins/${binId}`,
      });
      await restOperation.response;
    } catch (error) {
      console.error("Error deleting bin:", error);
      throw error;
    }
  }
}

export const apiService = new ApiService();

// Utility function to get auth token
const getAuthToken = async (): Promise<string | null> => {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() || null;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

// API call wrapper with error handling
const apiCall = async <T>(
  url: string,
  options: RequestInit = {},
  requireAuth: boolean = false
): Promise<T> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (requireAuth) {
    const token = await getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(
      errorData.message || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
};

// Citizen API endpoints
export const submitBinStatus = async (
  binId: string,
  statusValue: number
): Promise<BinStatusResponse> => {
  const request: BinStatusRequest = {
    status: {
      value: statusValue,
    },
  };

  return apiCall<BinStatusResponse>(`/bins/${binId}/status`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
};

// Admin API endpoints (require authentication)
export const getAllBins = async (): Promise<TrashBin[]> => {
  try {
    return await apiCall<TrashBin[]>("/admin/bins", {}, true);
  } catch (error) {
    // Fallback to mock data for development
    console.warn("Using mock data for bins:", error);
    return generateMockBins();
  }
};

export const getBinById = async (binId: string): Promise<TrashBin> => {
  try {
    return await apiCall<TrashBin>(`/admin/bins/${binId}`, {}, true);
  } catch (error) {
    console.warn("Using mock data for bin:", error);
    const mockBins = generateMockBins();
    const bin = mockBins.find((b) => b.binId === binId);
    if (!bin) throw new Error("Bin not found");
    return bin;
  }
};

export const createBin = async (
  binData: CreateBinRequest
): Promise<TrashBin> => {
  try {
    return await apiCall<TrashBin>(
      "/admin/bins",
      {
        method: "POST",
        body: JSON.stringify(binData),
      },
      true
    );
  } catch (error) {
    console.warn("Creating mock bin:", error);
    return {
      binId: `bin-${Date.now()}`,
      name: binData.name,
      status: 0,
      lastUpdated: new Date().toISOString(),
      reportsCount: 0,
      location: binData.location,
    };
  }
};

export const updateBin = async (
  binId: string,
  binData: Partial<CreateBinRequest>
): Promise<TrashBin> => {
  return apiCall<TrashBin>(
    `/admin/bins/${binId}`,
    {
      method: "PATCH",
      body: JSON.stringify(binData),
    },
    true
  );
};

export const deleteBin = async (binId: string): Promise<void> => {
  return apiCall<void>(
    `/admin/bins/${binId}`,
    {
      method: "DELETE",
    },
    true
  );
};

export const getBinReports = async (binId: string): Promise<StatusReport[]> => {
  try {
    return await apiCall<StatusReport[]>(
      `/admin/bins/${binId}/reports`,
      {},
      true
    );
  } catch (error) {
    console.warn("Using mock data for reports:", error);
    return generateMockReports(binId);
  }
};

export const getAnalytics = async () => {
  try {
    return await apiCall("/admin/analytics", {}, true);
  } catch (error) {
    console.warn("Using mock analytics data:", error);
    return generateMockAnalytics();
  }
};

// Mock data generators for development
const generateMockBins = (): TrashBin[] => {
  const locations = [
    {
      name: "Central Park Entrance",
      lat: 40.7829,
      lng: -73.9654,
      address: "Central Park West, New York, NY",
    },
    {
      name: "Times Square",
      lat: 40.758,
      lng: -73.9855,
      address: "Broadway & 42nd St, New York, NY",
    },
    {
      name: "Brooklyn Bridge",
      lat: 40.7061,
      lng: -73.9969,
      address: "Brooklyn Bridge, New York, NY",
    },
    {
      name: "High Line Park",
      lat: 40.748,
      lng: -74.0048,
      address: "High Line, New York, NY",
    },
    {
      name: "Washington Square Park",
      lat: 40.7308,
      lng: -73.9973,
      address: "Washington Square, New York, NY",
    },
  ];

  return locations.map((loc, index) => ({
    binId: `550e8400-e29b-41d4-a716-44665544000${index}`,
    name: loc.name,
    status: Math.floor(Math.random() * 11),
    lastUpdated: new Date(
      Date.now() - Math.random() * 86400000 * 7
    ).toISOString(),
    reportsCount: Math.floor(Math.random() * 50) + 10,
    location: {
      latitude: loc.lat,
      longitude: loc.lng,
      address: loc.address,
    },
  }));
};

const generateMockReports = (binId: string): StatusReport[] => {
  const reports: StatusReport[] = [];
  const now = new Date();

  for (let i = 0; i < 20; i++) {
    const date = new Date(now.getTime() - i * 3600000); // Each report 1 hour apart
    reports.push({
      binId,
      createdAt: date.toISOString(),
      status: Math.floor(Math.random() * 11),
    });
  }

  return reports.reverse(); // Oldest first
};

const generateMockAnalytics = () => {
  const now = new Date();
  const dailyData = [];
  const statusDistribution = [];

  // Generate daily collection data for last 30 days
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86400000);
    dailyData.push({
      date: date.toISOString().split("T")[0],
      collections: Math.floor(Math.random() * 20) + 5,
      reports: Math.floor(Math.random() * 100) + 50,
    });
  }

  // Generate status distribution
  const statuses = ["Empty", "Low", "Medium", "High", "Full"];
  statuses.forEach((status, index) => {
    statusDistribution.push({
      status,
      count: Math.floor(Math.random() * 30) + 10,
      percentage: Math.floor(Math.random() * 100),
    });
  });

  return {
    totalBins: 25,
    totalReports: 1247,
    averageStatus: 4.2,
    trendsData: dailyData,
    statusDistribution,
    alertsCount: 3,
  };
};

// QR Code generation utility
export const generateQRCodeData = (binId: string): string => {
  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${baseUrl}/scan?binId=${binId}`;
};

// Environment check
export const isProduction = (): boolean => {
  return import.meta.env.PROD || false;
};

export const isDevelopment = (): boolean => {
  return import.meta.env.DEV || false;
};
