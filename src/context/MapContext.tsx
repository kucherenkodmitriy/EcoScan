import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';

const libraries: ("places" | "drawing" | "geometry" | "localContext" | "visualization")[] = ['places'];

interface MapContextType {
  isLoaded: boolean;
  loadError: Error | undefined;
  geocode: (address: string) => Promise<{ lat: number; lng: number }>;
  reverseGeocode: (lat: number, lng: number) => Promise<string>;
}

export const MapContext = createContext<MapContextType>({
  isLoaded: false,
  loadError: undefined,
  geocode: async () => ({ lat: 0, lng: 0 }),
  reverseGeocode: async () => '',
});

interface MapProviderProps {
  children: ReactNode;
  googleMapsApiKey: string;
}

export const MapProvider: React.FC<MapProviderProps> = ({ children, googleMapsApiKey }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey,
    libraries,
  });

  const geocode = useCallback(
    async (address: string): Promise<{ lat: number; lng: number }> => {
      if (!isLoaded) {
        throw new Error('Google Maps API not loaded');
      }

      const geocoder = new window.google.maps.Geocoder();
      
      return new Promise((resolve, reject) => {
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const location = results[0].geometry.location;
            resolve({
              lat: location.lat(),
              lng: location.lng(),
            });
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });
    },
    [isLoaded]
  );

  const reverseGeocode = useCallback(
    async (lat: number, lng: number): Promise<string> => {
      if (!isLoaded) {
        throw new Error('Google Maps API not loaded');
      }

      const geocoder = new window.google.maps.Geocoder();
      const latLng = { lat, lng };
      
      return new Promise((resolve, reject) => {
        geocoder.geocode({ location: latLng }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            resolve(results[0].formatted_address);
          } else {
            reject(new Error(`Reverse geocoding failed: ${status}`));
          }
        });
      });
    },
    [isLoaded]
  );

  return (
    <MapContext.Provider
      value={{
        isLoaded,
        loadError,
        geocode,
        reverseGeocode,
      }}
    >
      {children}
    </MapContext.Provider>
  );
}; 