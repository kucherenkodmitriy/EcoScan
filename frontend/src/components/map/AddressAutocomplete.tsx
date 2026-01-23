import { useRef, useCallback } from 'react'
import { Autocomplete } from '@react-google-maps/api'
import { useGoogleMaps, useGoogleMapsApiKey } from './GoogleMapsProvider'
import styles from './AddressAutocomplete.module.css'

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelect?: (place: {
    address: string
    lat: number
    lng: number
  }) => void
  placeholder?: string
  required?: boolean
  id?: string
  disabled?: boolean
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Enter address',
  required = false,
  id = 'address',
  disabled = false,
}: AddressAutocompleteProps) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const apiKey = useGoogleMapsApiKey()
  const { isLoaded, loadError } = useGoogleMaps()

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete
  }, [])

  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace()

      if (place.formatted_address) {
        // Call onPlaceSelect with coords if available, otherwise just update address
        if (onPlaceSelect && place.geometry?.location) {
          onPlaceSelect({
            address: place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          })
        } else {
          onChange(place.formatted_address)
        }
      }
    }
  }, [onChange, onPlaceSelect])

  // If API key is missing or not loaded, show a regular input
  if (!apiKey || loadError || !isLoaded) {
    return (
      <div className={styles.wrapper}>
        <input
          type="text"
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={styles.input}
        />
        {!apiKey && (
          <span className={styles.hint}>Address autocomplete unavailable</span>
        )}
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <Autocomplete
        onLoad={onLoad}
        onPlaceChanged={onPlaceChanged}
        options={{
          types: ['address'],
          fields: ['formatted_address', 'geometry'],
        }}
      >
        <input
          ref={inputRef}
          type="text"
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={styles.input}
        />
      </Autocomplete>
    </div>
  )
}
