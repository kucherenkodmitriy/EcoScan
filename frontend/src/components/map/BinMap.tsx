import { useCallback, useMemo, useState } from 'react'
import { GoogleMap, InfoWindow, Marker } from '@react-google-maps/api'
import { Bin } from '../../api/client'
import { useGoogleMaps, useGoogleMapsApiKey } from './GoogleMapsProvider'
import BinInfoWindow from './BinInfoWindow'
import BinAdvancedMarker from './BinAdvancedMarker'
import styles from './BinMap.module.css'

interface BinMapProps {
  bins: Bin[]
  onMapClick?: (lat: number, lng: number) => void
  selectedBinId?: string | null
  onBinSelect?: (binId: string | null) => void
  center?: { lat: number; lng: number }
  zoom?: number
}

const defaultCenter = { lat: 50.4501, lng: 30.5234 } // Kyiv, Ukraine
const defaultZoom = 12

// Marker colors based on fullness
const getMarkerColor = (status: number): string => {
  if (status >= 70) return '#c62828'  // Red: 70-100%
  if (status >= 30) return '#f57c00'  // Yellow/Orange: 30-69%
  return '#2e7d32'                     // Green: 0-29%
}

export default function BinMap({
  bins,
  onMapClick,
  selectedBinId,
  onBinSelect,
  center = defaultCenter,
  zoom = defaultZoom,
}: BinMapProps) {
  const apiKey = useGoogleMapsApiKey()
  const { isLoaded, loadError } = useGoogleMaps()

  const mapId = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '').trim()

  // A real Map ID is an opaque string from Google Cloud Console (not just "1").
  // If it's missing/placeholder, we fall back to legacy markers.
  const useAdvancedMarkers = mapId.length >= 10

  const [map, setMap] = useState<google.maps.Map | null>(null)

  const onLoad = useCallback((loadedMap: google.maps.Map) => {
    setMap(loadedMap)
  }, [])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng && onMapClick) {
      onMapClick(e.latLng.lat(), e.latLng.lng())
    }
    // Deselect current bin when clicking on map
    if (onBinSelect) {
      onBinSelect(null)
    }
  }, [onMapClick, onBinSelect])

  const selectedBin = useMemo(
    () => bins.find(b => b.bin_id === selectedBinId),
    [bins, selectedBinId]
  )

  // Only show bins that have coordinates; treat missing is_active as active (older API responses).
  const binsWithCoords = useMemo(
    () => bins.filter(b => b.coordinates && b.is_active !== false),
    [bins]
  )

  // Calculate center from bins if available
  const mapCenter = useMemo(() => {
    if (binsWithCoords.length > 0) {
      const avgLat = binsWithCoords.reduce((sum, b) => sum + (b.coordinates?.latitude || 0), 0) / binsWithCoords.length
      const avgLng = binsWithCoords.reduce((sum, b) => sum + (b.coordinates?.longitude || 0), 0) / binsWithCoords.length
      return { lat: avgLat, lng: avgLng }
    }
    return center
  }, [binsWithCoords, center])

  // Show API key missing message
  if (!apiKey) {
    return (
      <div className={styles.errorState}>
        <h3>Google Maps API Key Required</h3>
        <p>Please configure VITE_GOOGLE_MAPS_API_KEY in your environment.</p>
        <p className={styles.hint}>Add it to frontend/.env.local</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={styles.errorState}>
        <h3>Failed to load Google Maps</h3>
        <p>Please check your API key configuration.</p>
        <p className={styles.hint}>{String(loadError.message || loadError)}</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className={styles.loadingState}>
        <div className="spinner"></div>
        <p>Loading map...</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <GoogleMap
        mapContainerClassName={styles.mapContainer}
        center={mapCenter}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={{
          ...(useAdvancedMarkers ? { mapId } : {}),
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          zoomControl: true,
        }}
      >
        {binsWithCoords.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 1,
              background: 'rgba(255,255,255,0.9)',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.08)',
              fontSize: 13,
              color: '#555',
            }}
          >
            No bins with coordinates to display.
          </div>
        )}

        {useAdvancedMarkers && map &&
          binsWithCoords.map((bin) => (
            <BinAdvancedMarker
              key={bin.bin_id}
              map={map}
              position={{
                lat: bin.coordinates!.latitude,
                lng: bin.coordinates!.longitude,
              }}
              color={getMarkerColor(bin.status || 0)}
              title={bin.name}
              onClick={() => onBinSelect?.(bin.bin_id)}
            />
          ))}

        {!useAdvancedMarkers &&
          binsWithCoords.map((bin) => (
            <Marker
              key={bin.bin_id}
              position={{
                lat: bin.coordinates!.latitude,
                lng: bin.coordinates!.longitude,
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: getMarkerColor(bin.status || 0),
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 12,
              }}
              onClick={() => onBinSelect?.(bin.bin_id)}
              title={bin.name}
            />
          ))}

        {selectedBin && selectedBin.coordinates && (
          <InfoWindow
            position={{
              lat: selectedBin.coordinates.latitude,
              lng: selectedBin.coordinates.longitude,
            }}
            onCloseClick={() => onBinSelect?.(null)}
          >
            <BinInfoWindow bin={selectedBin} />
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  )
}
