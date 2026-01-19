import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createBin, CreateBinInput } from '../../api/client'
import AddressAutocomplete from './AddressAutocomplete'
import styles from './AddBinModal.module.css'

const BIN_TYPES = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'plastic', label: 'Plastic' },
  { value: 'paper', label: 'Paper' },
  { value: 'glass', label: 'Glass' },
]

interface AddBinModalProps {
  isOpen: boolean
  onClose: () => void
  initialCoordinates?: { lat: number; lng: number } | null
  onBinCreated: () => void
}

type InputMode = 'address' | 'map' | 'coordinates'

export default function AddBinModal({
  isOpen,
  onClose,
  initialCoordinates,
  onBinCreated,
}: AddBinModalProps) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<InputMode>(initialCoordinates ? 'map' : 'address')

  const [name, setName] = useState('')
  const [binType, setBinType] = useState('mixed')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [geocoding, setGeocoding] = useState(false)

  // Reset form when modal opens with coordinates from map click
  useEffect(() => {
    if (isOpen && initialCoordinates) {
      setLatitude(initialCoordinates.lat.toFixed(6))
      setLongitude(initialCoordinates.lng.toFixed(6))
      setMode('map')
      // Reverse geocode to get address
      reverseGeocode(initialCoordinates.lat, initialCoordinates.lng)
    } else if (isOpen && !initialCoordinates) {
      setMode('address')
    }
  }, [isOpen, initialCoordinates])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen])

  const resetForm = () => {
    setName('')
    setBinType('mixed')
    setAddress('')
    setLatitude('')
    setLongitude('')
    setError('')
    setSaving(false)
    setGeocoding(false)
  }

  const reverseGeocode = async (lat: number, lng: number) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) return

    setGeocoding(true)
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
      )
      const data = await response.json()
      if (data.results && data.results[0]) {
        setAddress(data.results[0].formatted_address)
      }
    } catch (err) {
      console.error('Reverse geocoding failed:', err)
    } finally {
      setGeocoding(false)
    }
  }

  const geocodeAddress = async (addr: string): Promise<{ lat: number; lng: number } | null> => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setError('Google Maps API key not configured')
      return null
    }

    setGeocoding(true)
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${apiKey}`
      )
      const data = await response.json()
      if (data.results && data.results[0]) {
        const location = data.results[0].geometry.location
        return { lat: location.lat, lng: location.lng }
      }
      setError('Could not find location for this address')
      return null
    } catch (err) {
      setError('Geocoding failed. Please try again.')
      return null
    } finally {
      setGeocoding(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    let finalLat: number | undefined
    let finalLng: number | undefined

    if (mode === 'address') {
      if (!address.trim()) {
        setError('Address is required')
        return
      }
      // Use pre-filled coordinates from autocomplete if available
      if (latitude && longitude) {
        finalLat = parseFloat(latitude)
        finalLng = parseFloat(longitude)
      } else {
        // Fallback to geocoding if user typed address manually
        const coords = await geocodeAddress(address)
        if (!coords) return
        finalLat = coords.lat
        finalLng = coords.lng
      }
    } else {
      // map or coordinates mode
      if (latitude && longitude) {
        finalLat = parseFloat(latitude)
        finalLng = parseFloat(longitude)
        if (isNaN(finalLat) || isNaN(finalLng)) {
          setError('Invalid coordinates')
          return
        }
      } else if (mode === 'coordinates') {
        setError('Coordinates are required')
        return
      }
    }

    setSaving(true)

    try {
      const data: CreateBinInput = {
        name: name.trim(),
        bin_type: binType,
        address: address.trim() || undefined,
        latitude: finalLat,
        longitude: finalLng,
      }
      const newBin = await createBin(data)
      onBinCreated()
      onClose()
      navigate(`/bins/${newBin.bin_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bin')
      setSaving(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Add New Bin</h3>
          <button className={styles.closeBtn} onClick={handleClose}>&times;</button>
        </div>

        <div className={styles.modeSelector}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'address' ? styles.active : ''}`}
            onClick={() => setMode('address')}
          >
            Enter Address
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'map' ? styles.active : ''}`}
            onClick={() => setMode('map')}
            disabled={!initialCoordinates}
            title={!initialCoordinates ? 'Click on the map first' : ''}
          >
            From Map Click
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'coordinates' ? styles.active : ''}`}
            onClick={() => setMode('coordinates')}
          >
            Enter Coordinates
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter bin name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="binType">Type</label>
            <select
              id="binType"
              value={binType}
              onChange={(e) => setBinType(e.target.value)}
              className={styles.select}
            >
              {BIN_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {mode === 'address' && (
            <div className="form-group">
              <label htmlFor="address">Address *</label>
              <AddressAutocomplete
                id="address"
                value={address}
                onChange={setAddress}
                onPlaceSelect={(place) => {
                  setAddress(place.address)
                  setLatitude(place.lat.toFixed(6))
                  setLongitude(place.lng.toFixed(6))
                }}
                placeholder="Start typing an address..."
                required
              />
            </div>
          )}

          {mode === 'map' && (
            <div className={styles.coordDisplay}>
              <p>Location selected from map:</p>
              <code>{latitude}, {longitude}</code>
              {geocoding && <span className={styles.geocoding}>Looking up address...</span>}
              {address && !geocoding && <p className={styles.resolvedAddress}>{address}</p>}
            </div>
          )}

          {mode === 'coordinates' && (
            <>
              <div className="form-group">
                <label htmlFor="addressOptional">Address (optional)</label>
                <AddressAutocomplete
                  id="addressOptional"
                  value={address}
                  onChange={setAddress}
                  onPlaceSelect={(place) => {
                    setAddress(place.address)
                    // Don't override coordinates in coordinates mode
                  }}
                  placeholder="Enter address description"
                />
              </div>
              <div className={styles.coordRow}>
                <div className="form-group">
                  <label htmlFor="latitude">Latitude *</label>
                  <input
                    type="number"
                    id="latitude"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 50.4501"
                    step="any"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="longitude">Longitude *</label>
                  <input
                    type="number"
                    id="longitude"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 30.5234"
                    step="any"
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              style={{ background: '#666', border: 'none' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || geocoding}
            >
              {saving ? 'Creating...' : 'Create Bin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
