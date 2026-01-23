import { useState, useEffect } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import AddressAutocomplete from './AddressAutocomplete'
import styles from './RouteModal.module.css'

// Helper to hide Google Places autocomplete dropdowns
const hidePacContainers = () => {
  document.querySelectorAll('.pac-container').forEach((el) => {
    ;(el as HTMLElement).style.display = 'none'
  })
}

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
  const { t } = useTranslation()
  const [startAddress, setStartAddress] = useState('')
  const [startCoords, setStartCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [endAddress, setEndAddress] = useState('')
  const [endCoords, setEndCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!startCoords) {
      setError(t('routeModal.errorSelectStart'))
      return
    }

    if (!endCoords) {
      setError(t('routeModal.errorSelectEnd'))
      return
    }

    if (waypointCount === 0) {
      setError(t('routeModal.errorNoBins'))
      return
    }

    if (waypointCount > 23) {
      setError(t('routeModal.errorTooManyWaypoints', { count: waypointCount }))
      return
    }

    onCreateRoute(
      { address: startAddress, ...startCoords },
      { address: endAddress, ...endCoords }
    )
  }

  const handleClose = () => {
    hidePacContainers()
    setStartAddress('')
    setStartCoords(null)
    setEndAddress('')
    setEndCoords(null)
    setError('')
    onClose()
  }

  // Hide pac-containers when modal closes
  useEffect(() => {
    if (!isOpen) {
      hidePacContainers()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{t('routeModal.title')}</h3>
          <button className={styles.closeBtn} onClick={handleClose}>&times;</button>
        </div>

        <p className={styles.description}>
          <Trans
            i18nKey="routeModal.description"
            values={{ count: waypointCount, plural: waypointCount !== 1 ? 's' : '' }}
            components={{ strong: <strong /> }}
          />
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label htmlFor="startPoint">{t('routeModal.startPoint')} *</label>
            <AddressAutocomplete
              id="startPoint"
              value={startAddress}
              onChange={setStartAddress}
              onPlaceSelect={(place) => {
                setStartAddress(place.address)
                setStartCoords({ lat: place.lat, lng: place.lng })
              }}
              placeholder={t('routeModal.startPlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="endPoint">{t('routeModal.endPoint')} *</label>
            <AddressAutocomplete
              id="endPoint"
              value={endAddress}
              onChange={setEndAddress}
              onPlaceSelect={(place) => {
                setEndAddress(place.address)
                setEndCoords({ lat: place.lat, lng: place.lng })
              }}
              placeholder={t('routeModal.endPlaceholder')}
              required
            />
          </div>

          <div className={styles.info}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12" y2="8"/>
            </svg>
            <span>{t('routeModal.efficientOrderInfo')}</span>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              style={{ background: '#666', border: 'none' }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={waypointCount === 0}
            >
              {t('routeModal.createRoute')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
