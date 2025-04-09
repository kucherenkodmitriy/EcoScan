export interface Location {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export interface TrashBin {
  id: string;
  name: string;
  locationId: string;
  qrCodeId: string;
  status: BinStatus;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

export interface QRCode {
  id: string;
  url: string;
  binId: string;
  createdAt: string;
}

export enum BinStatus {
  OK = "OK",
  FULL = "FULL"
}

export enum UserRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER"
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface StatusUpdate {
  id: string;
  binId: string;
  status: BinStatus;
  timestamp: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
} 