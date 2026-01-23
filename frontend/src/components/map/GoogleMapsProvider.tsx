import { createContext, useContext, ReactNode } from 'react'
import { useJsApiLoader, Libraries } from '@react-google-maps/api'

// Define libraries to load - include 'places' for autocomplete and 'marker' for AdvancedMarkerElement
const libraries: Libraries = ['places', 'marker']

interface GoogleMapsContextType {
  isLoaded: boolean
  loadError: Error | undefined
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({
  isLoaded: false,
  loadError: undefined,
})

interface GoogleMapsProviderProps {
  children: ReactNode
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey: apiKey,
    libraries,
    version: 'weekly',
  })

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  )
}

export function useGoogleMaps() {
  return useContext(GoogleMapsContext)
}

export function useGoogleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
}
