import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getBins, Bin } from '../api/client'
import BinMap from '../components/map/BinMap'
import FullnessSlider from '../components/map/FullnessSlider'
import AddBinModal from '../components/map/AddBinModal'
import RouteModal from '../components/map/RouteModal'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Footer from '../components/Footer'
import { useGoogleMaps } from '../components/map/GoogleMapsProvider'
import styles from './Dashboard.module.css'

type ViewMode = 'map' | 'list'

function getStatusClass(status: number): string {
  if (status >= 70) return styles.high
  if (status >= 30) return styles.medium
  return styles.low
}

function formatDate(dateStr: string | null, t: (key: string) => string): string {
  if (!dateStr) return t('common.never')
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const [bins, setBins] = useState<Bin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [fullnessFilter, setFullnessFilter] = useState<[number, number]>([0, 100])
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null)

  // Add bin modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [mapClickCoords, setMapClickCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Route modal state
  const [showRouteModal, setShowRouteModal] = useState(false)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)

  const { isLoaded } = useGoogleMaps()

  const loadBins = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getBins()
      // Sort by fullness descending
      data.sort((a, b) => (b.status || 0) - (a.status || 0))
      setBins(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bins')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBins()
  }, [])

  // Filter bins by fullness range
  const filteredBins = useMemo(() => {
    return bins.filter((b) => {
      const status = b.status || 0
      return status >= fullnessFilter[0] && status <= fullnessFilter[1]
    })
  }, [bins, fullnessFilter])

  // Stats (using all active bins, not filtered)
  const activeBins = bins.filter((b) => b.is_active)
  const fullBins = activeBins.filter((b) => (b.status || 0) >= 70).length
  const fillingBins = activeBins.filter((b) => {
    const f = b.status || 0
    return f >= 30 && f < 70
  }).length
  const availableBins = activeBins.filter((b) => (b.status || 0) < 30).length

  // Count bins without coordinates
  const binsWithoutCoords = bins.filter(b => !b.coordinates && b.is_active).length

  // Handle map click for adding bin
  const handleMapClick = (lat: number, lng: number) => {
    setMapClickCoords({ lat, lng })
    setShowAddModal(true)
  }

  // Handle add button click
  const handleAddClick = () => {
    setMapClickCoords(null)
    setShowAddModal(true)
  }

  // Handle bin created
  const handleBinCreated = () => {
    loadBins()
  }

  // Get bins with coordinates for routing
  const binsWithCoords = useMemo(() => {
    return filteredBins.filter(b => b.coordinates && b.is_active)
  }, [filteredBins])

  // Handle route creation
  const handleCreateRoute = useCallback(
    async (
      start: { address: string; lat: number; lng: number },
      end: { address: string; lat: number; lng: number }
    ) => {
      if (!isLoaded) return

      setRouteLoading(true)
      setShowRouteModal(false)

      try {
        const directionsService = new google.maps.DirectionsService()

        // Create waypoints from bins with coordinates
        const waypoints: google.maps.DirectionsWaypoint[] = binsWithCoords.map((bin) => ({
          location: new google.maps.LatLng(
            bin.coordinates!.latitude,
            bin.coordinates!.longitude
          ),
          stopover: true,
        }))

        const result = await directionsService.route({
          origin: new google.maps.LatLng(start.lat, start.lng),
          destination: new google.maps.LatLng(end.lat, end.lng),
          waypoints,
          optimizeWaypoints: true, // Let Google find the best order
          travelMode: google.maps.TravelMode.DRIVING,
        })

        setDirections(result)
      } catch (err) {
        alert('Failed to create route. Please try again.')
      } finally {
        setRouteLoading(false)
      }
    },
    [isLoaded, binsWithCoords]
  )

  // Clear route
  const handleClearRoute = () => {
    setDirections(null)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>{t('common.appName')}</h1>
        </div>
        <div className={styles.headerRight}>
          <LanguageSwitcher />
          <Link to="/webhooks" className="btn btn-secondary" style={{ background: '#6a1b9a', border: 'none' }}>
            {t('webhooks.title')}
          </Link>
          <Link to="/api-keys" className="btn btn-secondary" style={{ background: '#1565c0', border: 'none' }}>
            {t('apiKeys.title')}
          </Link>
          <div className={styles.userInfo}>
            <strong>{user?.name}</strong>
            <span>{user?.role}</span>
          </div>
          <button className="btn btn-secondary" onClick={logout}>
            {t('common.logout')}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Stats Bar */}
        <div className={styles.statsBar}>
          <div className={styles.statCard}>
            <h3>{t('dashboard.totalBins')}</h3>
            <div className={styles.statValue}>{activeBins.length}</div>
          </div>
          <div className={`${styles.statCard} ${styles.critical}`}>
            <h3>{t('dashboard.fullBins')}</h3>
            <div className={styles.statValue}>{fullBins}</div>
          </div>
          <div className={`${styles.statCard} ${styles.warning}`}>
            <h3>{t('dashboard.fillingBins')}</h3>
            <div className={styles.statValue}>{fillingBins}</div>
          </div>
          <div className={`${styles.statCard} ${styles.good}`}>
            <h3>{t('dashboard.availableBins')}</h3>
            <div className={styles.statValue}>{availableBins}</div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className={styles.controlsBar}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'map' ? styles.active : ''}`}
              onClick={() => setViewMode('map')}
            >
              {t('dashboard.mapView')}
            </button>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
            >
              {t('dashboard.showAsList')}
            </button>
          </div>

          {viewMode === 'map' && (
            <>
              <FullnessSlider value={fullnessFilter} onChange={setFullnessFilter} />
              <div className={styles.routeActions}>
                {directions ? (
                  <button
                    className="btn btn-secondary"
                    onClick={handleClearRoute}
                    style={{ background: '#c62828', border: 'none' }}
                  >
                    {t('dashboard.clearRoute')}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowRouteModal(true)}
                    disabled={routeLoading || binsWithCoords.length === 0}
                    style={{ background: '#1565c0', border: 'none' }}
                  >
                    {routeLoading ? t('dashboard.creating') : t('dashboard.createRoute')}
                  </button>
                )}
              </div>
            </>
          )}

          <div className={styles.headerActions}>
            <button className="btn btn-secondary" onClick={loadBins} disabled={loading} style={{ background: '#666', border: 'none' }}>
              {loading ? t('common.loading') : t('common.refresh')}
            </button>
            <Link to="/print" className="btn btn-secondary" style={{ background: '#1565c0', border: 'none' }}>
              {t('dashboard.printQR')}
            </Link>
            {viewMode === 'list' && (
              <Link to="/bins/new" className="btn btn-primary">
                {t('dashboard.newBin')}
              </Link>
            )}
          </div>
        </div>

        {/* Warning for bins without coordinates */}
        {viewMode === 'map' && binsWithoutCoords > 0 && (
          <div className={styles.coordsWarning}>
            {t('dashboard.coordsWarning', { count: binsWithoutCoords })}
          </div>
        )}

        {/* Main Content */}
        {error ? (
          <div className={styles.errorState}>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={loadBins}>
              {t('dashboard.tryAgain')}
            </button>
          </div>
        ) : viewMode === 'map' ? (
          <div className={styles.mapWrapper}>
            {loading && bins.length === 0 ? (
              <div className={styles.loadingState}>
                <div className="spinner"></div>
                <p>{t('dashboard.loadingBins')}</p>
              </div>
            ) : (
              <>
                <BinMap
                  bins={filteredBins}
                  onMapClick={handleMapClick}
                  selectedBinId={selectedBinId}
                  onBinSelect={setSelectedBinId}
                  directions={directions}
                />
                <button
                  className={styles.fabAdd}
                  onClick={handleAddClick}
                  title={t('binForm.createTitle')}
                >
                  +
                </button>
              </>
            )}
          </div>
        ) : (
          /* List View */
          <div className={styles.tableContainer}>
            {loading && bins.length === 0 ? (
              <div className={styles.loadingState}>
                <div className="spinner"></div>
                <p>{t('dashboard.loadingBins')}</p>
              </div>
            ) : bins.length === 0 ? (
              <div className={styles.emptyState}>
                <p>{t('dashboard.noBinsFound')}</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('dashboard.table.name')}</th>
                    <th>{t('dashboard.table.type')}</th>
                    <th>{t('dashboard.table.address')}</th>
                    <th>{t('dashboard.table.fullness')}</th>
                    <th>{t('dashboard.table.reports')}</th>
                    <th>{t('dashboard.table.lastUpdated')}</th>
                    <th>{t('dashboard.table.status')}</th>
                    <th>{t('dashboard.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bins.map((bin) => (
                    <tr key={bin.bin_id}>
                      <td>
                        <Link to={`/bins/${bin.bin_id}`} className={styles.binLink}>
                          <strong>{bin.name || t('binDetail.unnamed')}</strong>
                        </Link>
                      </td>
                      <td>
                        <span className={`badge badge-${bin.bin_type?.toLowerCase() || 'general'}`}>
                          {t(`binTypes.${bin.bin_type?.toLowerCase() || 'general'}`)}
                        </span>
                      </td>
                      <td>{bin.address || '-'}</td>
                      <td>
                        <div className={`${styles.statusBar} ${getStatusClass(bin.status || 0)}`}>
                          <div className={styles.bar}>
                            <div
                              className={styles.barFill}
                              style={{ width: `${bin.status || 0}%` }}
                            ></div>
                          </div>
                          <span className={styles.percent}>{bin.status || 0}%</span>
                        </div>
                      </td>
                      <td>{bin.reports_count || 0}</td>
                      <td>{formatDate(bin.last_updated, t)}</td>
                      <td>
                        <span className={`badge ${bin.is_active ? 'badge-active' : 'badge-inactive'}`}>
                          {bin.is_active ? t('common.active') : t('common.inactive')}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <Link to={`/bins/${bin.bin_id}`} className={styles.actionBtn} title={t('common.view')}>
                            {t('common.view')}
                          </Link>
                          <Link to={`/bins/${bin.bin_id}/edit`} className={styles.actionBtn} title={t('common.edit')}>
                            {t('common.edit')}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* Add Bin Modal */}
      <AddBinModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setMapClickCoords(null)
        }}
        initialCoordinates={mapClickCoords}
        onBinCreated={handleBinCreated}
      />

      {/* Route Modal */}
      <RouteModal
        isOpen={showRouteModal}
        onClose={() => setShowRouteModal(false)}
        onCreateRoute={handleCreateRoute}
        waypointCount={binsWithCoords.length}
      />

      <Footer variant="dark" />
    </div>
  )
}
