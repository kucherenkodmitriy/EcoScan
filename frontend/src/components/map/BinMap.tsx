import { useCallback, useMemo } from 'react'
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { Bin } from '../../api/client'
import { useGoogleMaps, useGoogleMapsApiKey } from './GoogleMapsProvider'
import BinInfoWindow from './BinInfoWindow'
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

  const onLoad = useCallback((_map: google.maps.Map) => {
    // Map instance available if needed for future features
  }, [])

  const onUnmount = useCallback(() => {
    // Cleanup if needed
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

  // Only show bins that have coordinates
  const binsWithCoords = useMemo(
    () => bins.filter(b => b.coordinates && b.is_active),
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
    <GoogleMap
      mapContainerClassName={styles.mapContainer}
      center={mapCenter}
      zoom={zoom}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={handleMapClick}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        zoomControl: true,
      }}
    >
      {binsWithCoords.map((bin) => (
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
  )
}
