import { useState } from 'react'
import AddressAutocomplete from './AddressAutocomplete'
import styles from './RouteModal.module.css'

interface RoutePoint {
  address: string
  lat: number
  lng: number
}

interface RouteModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateRoute: (start: RoutePoint, end: RoutePoint) => void
  waypointCount: number
}

export default function RouteModal({
  isOpen,
  onClose,
  onCreateRoute,
  waypointCount,
}: RouteModalProps) {
  const [startAddress, setStartAddress] = useState('')
  const [startCoords, setStartCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [endAddress, setEndAddress] = useState('')
  const [endCoords, setEndCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!startCoords) {
      setError('Please select a valid start point from the suggestions')
      return
    }

    if (!endCoords) {
      setError('Please select a valid end point from the suggestions')
      return
    }

    if (waypointCount === 0) {
      setError('No bins to route through. Adjust your filters to include some bins.')
      return
    }

    if (waypointCount > 23) {
      setError(`Too many waypoints (${waypointCount}). Google Maps supports max 23 intermediate stops. Please filter to fewer bins.`)
      return
    }

    onCreateRoute(
      { address: startAddress, ...startCoords },
      { address: endAddress, ...endCoords }
    )
  }

  const handleClose = () => {
    setStartAddress('')
    setStartCoords(null)
    setEndAddress('')
    setEndCoords(null)
    setError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Create Collection Route</h3>
          <button className={styles.closeBtn} onClick={handleClose}>&times;</button>
        </div>

        <p className={styles.description}>
          Build an optimized route through <strong>{waypointCount}</strong> bin{waypointCount !== 1 ? 's' : ''} currently shown on the map.
          Google Maps will automatically find the most efficient order.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label htmlFor="startPoint">Start Point *</label>
            <AddressAutocomplete
              id="startPoint"
              value={startAddress}
              onChange={(value) => {
                setStartAddress(value)
                setStartCoords(null) // Clear coords when typing manually
              }}
              onPlaceSelect={(place) => {
                setStartAddress(place.address)
                setStartCoords({ lat: place.lat, lng: place.lng })
              }}
              placeholder="Enter starting address..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="endPoint">End Point *</label>
            <AddressAutocomplete
              id="endPoint"
              value={endAddress}
              onChange={(value) => {
                setEndAddress(value)
                setEndCoords(null)
              }}
              onPlaceSelect={(place) => {
                setEndAddress(place.address)
                setEndCoords({ lat: place.lat, lng: place.lng })
              }}
              placeholder="Enter destination address..."
              required
            />
          </div>

          <div className={styles.info}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12" y2="8"/>
            </svg>
            <span>The route will visit bins in the most efficient order</span>
          </div>

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
              disabled={waypointCount === 0}
            >
              Create Route
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
