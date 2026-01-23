import { useEffect, useMemo, useRef } from 'react'

export interface BinAdvancedMarkerProps {
  map: google.maps.Map
  position: google.maps.LatLngLiteral
  title?: string
  color: string
  onClick?: () => void
}

/**
 * Lightweight wrapper around google.maps.marker.AdvancedMarkerElement.
 * We use this instead of google.maps.Marker (deprecated).
 */
export default function BinAdvancedMarker({
  map,
  position,
  title,
  color,
  onClick,
}: BinAdvancedMarkerProps) {
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null)

  const content = useMemo(() => {
    const div = document.createElement('div')
    div.style.width = '18px'
    div.style.height = '18px'
    div.style.borderRadius = '50%'
    div.style.background = color
    div.style.border = '2px solid #ffffff'
    div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.35)'
    return div
  }, [color])

  useEffect(() => {
    // Advanced Marker library may not be present if the marker library isn't loaded.
    if (!google.maps.marker?.AdvancedMarkerElement) {
      return
    }

    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      title,
      content,
    })

    markerRef.current = marker

    if (onClick) {
      listenerRef.current = marker.addListener('click', () => onClick())
    }

    return () => {
      if (listenerRef.current) {
        listenerRef.current.remove()
        listenerRef.current = null
      }
      // Detach marker from map
      marker.map = null
      markerRef.current = null
    }
  }, [map, position, title, content, onClick])

  // Keep position in sync without recreating marker when possible
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.position = position
    }
  }, [position])

  return null
}

