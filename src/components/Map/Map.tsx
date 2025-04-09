import React, { useContext, useCallback, useState } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { MapContext } from '../../context/MapContext';

interface MapProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  height?: string;
  width?: string;
  onClick?: (lat: number, lng: number) => void;
  showMarker?: boolean;
}

const containerStyle = {
  width: '100%',
  height: '400px',
};

export const Map: React.FC<MapProps> = ({
  latitude = 50.0755, // Default to Prague, Czech Republic
  longitude = 14.4378,
  zoom = 13,
  height = '400px',
  width = '100%',
  onClick,
  showMarker = true,
}) => {
  const { isLoaded } = useContext(MapContext);
  const [marker, setMarker] = useState({ lat: latitude, lng: longitude });

  const handleMapClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return;
      
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      
      setMarker({ lat, lng });
      
      if (onClick) {
        onClick(lat, lng);
      }
    },
    [onClick]
  );

  const mapContainerStyle = {
    width,
    height,
  };

  if (!isLoaded) {
    return <div style={mapContainerStyle}>Loading map...</div>;
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={{ lat: latitude, lng: longitude }}
      zoom={zoom}
      onClick={handleMapClick}
    >
      {showMarker && <Marker position={marker} />}
    </GoogleMap>
  );
}; 