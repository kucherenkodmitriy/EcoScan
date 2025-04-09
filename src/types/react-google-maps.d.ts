declare module '@react-google-maps/api' {
  import { ReactNode } from 'react';

  export interface GoogleMapProps {
    mapContainerStyle?: {
      width?: string;
      height?: string;
    };
    center?: {
      lat: number;
      lng: number;
    };
    zoom?: number;
    onClick?: (event: google.maps.MapMouseEvent) => void;
    children?: ReactNode;
  }

  export const GoogleMap: React.FC<GoogleMapProps>;
  export const Marker: React.FC<{
    position: {
      lat: number;
      lng: number;
    };
  }>;

  export interface UseJsApiLoaderOptions {
    googleMapsApiKey: string;
    libraries?: ("places" | "drawing" | "geometry" | "localContext" | "visualization")[];
  }

  export interface UseJsApiLoaderReturn {
    isLoaded: boolean;
    loadError?: Error;
  }

  export function useJsApiLoader(options: UseJsApiLoaderOptions): UseJsApiLoaderReturn;
} 