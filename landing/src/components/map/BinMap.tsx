import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { GoogleMap, DirectionsRenderer } from '@react-google-maps/api'
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer'
import { useTranslation } from 'react-i18next'
import { Bin } from '../../api/client'
import { useGoogleMaps, useGoogleMapsApiKey } from './GoogleMapsProvider'
import styles from './BinMap.module.css'

interface BinMapProps {
  bins: Bin[]
  onMapClick?: (lat: number, lng: number) => void
  selectedBinId?: string | null
  onBinSelect?: (binId: string | null) => void
  center?: { lat: number; lng: number }
  zoom?: number
  directions?: google.maps.DirectionsResult | null
}

const defaultCenter = { lat: 50.4501, lng: 30.5234 } // Kyiv, Ukraine
const defaultZoom = 12

// Marker colors based on fullness
const getMarkerColor = (status: number): string => {
  if (status >= 70) return '#c62828'  // Red: 70-100%
  if (status >= 30) return '#f57c00'  // Yellow/Orange: 30-69%
  return '#2e7d32'                     // Green: 0-29%
}

// Create a colored SVG marker icon
const createMarkerIcon = (color: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="${color}" stroke="#ffffff" stroke-width="2"/>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

// Custom cluster renderer
const clusterRenderer = {
  render: ({ count, position }: { count: number; position: google.maps.LatLng }) => {
    // Color based on cluster size
    let color = '#2e7d32' // Green for small clusters
    if (count >= 10) color = '#c62828' // Red for large
    else if (count >= 5) color = '#f57c00' // Orange for medium

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <text x="20" y="25" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="bold">${count}</text>
    </svg>`

    return new google.maps.Marker({
      position,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(40, 40),
      },
      label: undefined,
      zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
    })
  },
}

export default function BinMap({
  bins,
  onMapClick,
  selectedBinId,
  onBinSelect,
  center = defaultCenter,
  zoom = defaultZoom,
  directions = null,
}: BinMapProps) {
  const { t } = useTranslation()
  const apiKey = useGoogleMapsApiKey()
  const { isLoaded, loadError } = useGoogleMaps()

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  const onLoad = useCallback((loadedMap: google.maps.Map) => {
    setMap(loadedMap)
  }, [])

  const onUnmount = useCallback(() => {
    // Clean up InfoWindow
    if (infoWindowRef.current) {
      infoWindowRef.current.close()
      infoWindowRef.current = null
    }
    // Clean up clusterer and markers
    if (clustererRef.current) {
      clustererRef.current.clearMarkers()
      clustererRef.current = null
    }
    markersRef.current.clear()
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
    // Close the InfoWindow
    if (infoWindowRef.current) {
      infoWindowRef.current.close()
    }
  }, [onMapClick, onBinSelect])

  // Close InfoWindow when selection is cleared externally
  useEffect(() => {
    if (!selectedBinId && infoWindowRef.current) {
      infoWindowRef.current.close()
    }
  }, [selectedBinId])

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

  // Create/update markers and clusterer when bins or map changes
  useEffect(() => {
    if (!map || !isLoaded) return

    // Clean up previous clusterer completely
    if (clustererRef.current) {
      clustererRef.current.setMap(null)
      clustererRef.current = null
    }

    // Clear old markers
    markersRef.current.forEach((marker) => {
      google.maps.event.clearInstanceListeners(marker)
      marker.setMap(null)
    })
    markersRef.current.clear()

    if (binsWithCoords.length === 0) {
      return
    }

    // Create new markers
    const newMarkers: google.maps.Marker[] = []

    binsWithCoords.forEach((bin) => {
      const marker = new google.maps.Marker({
        position: {
          lat: bin.coordinates!.latitude,
          lng: bin.coordinates!.longitude,
        },
        icon: {
          url: createMarkerIcon(getMarkerColor(bin.status || 0)),
          scaledSize: new google.maps.Size(24, 24),
        },
        // Don't use title - it creates a browser tooltip that interferes with InfoWindow
      })

      // Add click listener
      marker.addListener('click', () => {
        onBinSelect?.(bin.bin_id)

        // Show InfoWindow using native Google Maps API with HTML content
        if (!infoWindowRef.current) {
          infoWindowRef.current = new google.maps.InfoWindow()
          infoWindowRef.current.addListener('closeclick', () => {
            onBinSelect?.(null)
          })
        }

        // Determine status color
        const statusColor = bin.status >= 70 ? '#c62828' : bin.status >= 30 ? '#f57c00' : '#2e7d32'
        const binType = bin.bin_type?.toLowerCase() || 'mixed'

        // Create HTML content for InfoWindow
        const content = `
          <div style="padding: 8px; max-width: 250px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <h4 style="font-size: 16px; font-weight: 600; color: #333; margin: 0 0 8px 0;">${bin.name}</h4>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <span class="badge badge-${binType}" style="padding: 2px 8px; border-radius: 4px; font-size: 12px;">${binType}</span>
              <div style="font-size: 14px; color: ${statusColor};"><strong>${bin.status || 0}%</strong></div>
            </div>
            ${bin.address ? `<p style="font-size: 13px; color: #666; margin: 0 0 12px 0;">${bin.address}</p>` : ''}
            <a href="/bins/${bin.bin_id}" style="display: inline-block; color: #2e7d32; font-size: 14px; font-weight: 500; text-decoration: none;">View Details →</a>
          </div>
        `

        infoWindowRef.current.setContent(content)
        infoWindowRef.current.open(map, marker)
      })

      markersRef.current.set(bin.bin_id, marker)
      newMarkers.push(marker)
    })

    // Create new clusterer
    clustererRef.current = new MarkerClusterer({
      map,
      markers: newMarkers,
      algorithm: new SuperClusterAlgorithm({ radius: 80 }),
      renderer: clusterRenderer,
    })

    // Cleanup function
    return () => {
      if (clustererRef.current) {
        clustererRef.current.setMap(null)
        clustererRef.current = null
      }
      markersRef.current.forEach((marker) => {
        google.maps.event.clearInstanceListeners(marker)
        marker.setMap(null)
      })
      markersRef.current.clear()
    }
  }, [map, isLoaded, binsWithCoords, onBinSelect])

  // Show API key missing message
  if (!apiKey) {
    return (
      <div className={styles.errorState}>
        <h3>{t('map.apiKeyRequired')}</h3>
        <p>{t('map.configureApiKey')}</p>
        <p className={styles.hint}>{t('map.addToEnvHint')}</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={styles.errorState}>
        <h3>{t('map.failedToLoad')}</h3>
        <p>{t('map.checkApiKeyConfig')}</p>
        <p className={styles.hint}>{String(loadError.message || loadError)}</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className={styles.loadingState}>
        <div className="spinner"></div>
        <p>{t('map.loadingMap')}</p>
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
            {t('map.noBinsToDisplay')}
          </div>
        )}

        {/* Markers are managed by MarkerClusterer via useEffect */}

        {/* Render route if directions are provided */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: false, // Show A, B, C markers for stops
              polylineOptions: {
                strokeColor: '#1976d2',
                strokeWeight: 5,
                strokeOpacity: 0.8,
              },
            }}
          />
        )}

        {/* InfoWindow is managed natively via google.maps.InfoWindow in marker click handler */}
      </GoogleMap>
    </div>
  )
}
