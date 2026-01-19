import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getBins, Bin } from '../api/client'
import BinMap from '../components/map/BinMap'
import FullnessSlider from '../components/map/FullnessSlider'
import AddBinModal from '../components/map/AddBinModal'
import styles from './Dashboard.module.css'

type ViewMode = 'map' | 'list'

function getStatusClass(status: number): string {
  if (status >= 70) return styles.high
  if (status >= 30) return styles.medium
  return styles.low
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Dashboard() {
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>EcoScan</h1>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.userInfo}>
            <strong>{user?.name}</strong>
            <span>{user?.role}</span>
          </div>
          <button className="btn btn-secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Stats Bar */}
        <div className={styles.statsBar}>
          <div className={styles.statCard}>
            <h3>Total Bins</h3>
            <div className={styles.statValue}>{activeBins.length}</div>
          </div>
          <div className={`${styles.statCard} ${styles.critical}`}>
            <h3>Full (70%+)</h3>
            <div className={styles.statValue}>{fullBins}</div>
          </div>
          <div className={`${styles.statCard} ${styles.warning}`}>
            <h3>Filling (30-69%)</h3>
            <div className={styles.statValue}>{fillingBins}</div>
          </div>
          <div className={`${styles.statCard} ${styles.good}`}>
            <h3>Available (&lt;30%)</h3>
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
              Map View
            </button>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
            >
              Show as List
            </button>
          </div>

          {viewMode === 'map' && (
            <FullnessSlider value={fullnessFilter} onChange={setFullnessFilter} />
          )}

          <div className={styles.headerActions}>
            <button className="btn btn-secondary" onClick={loadBins} disabled={loading} style={{ background: '#666', border: 'none' }}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <Link to="/print" className="btn btn-secondary" style={{ background: '#1565c0', border: 'none' }}>
              Print QR
            </Link>
            {viewMode === 'list' && (
              <Link to="/bins/new" className="btn btn-primary">
                + New Bin
              </Link>
            )}
          </div>
        </div>

        {/* Warning for bins without coordinates */}
        {viewMode === 'map' && binsWithoutCoords > 0 && (
          <div className={styles.coordsWarning}>
            {binsWithoutCoords} bin(s) not shown on map (missing coordinates)
          </div>
        )}

        {/* Main Content */}
        {error ? (
          <div className={styles.errorState}>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={loadBins}>
              Try Again
            </button>
          </div>
        ) : viewMode === 'map' ? (
          <div className={styles.mapWrapper}>
            {loading && bins.length === 0 ? (
              <div className={styles.loadingState}>
                <div className="spinner"></div>
                <p>Loading bins...</p>
              </div>
            ) : (
              <>
                <BinMap
                  bins={filteredBins}
                  onMapClick={handleMapClick}
                  selectedBinId={selectedBinId}
                  onBinSelect={setSelectedBinId}
                />
                <button
                  className={styles.fabAdd}
                  onClick={handleAddClick}
                  title="Add new bin"
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
                <p>Loading bins...</p>
              </div>
            ) : bins.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No bins found. Create your first bin to get started.</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Address</th>
                    <th>Fullness</th>
                    <th>Reports</th>
                    <th>Last Updated</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bins.map((bin) => (
                    <tr key={bin.bin_id}>
                      <td>
                        <Link to={`/bins/${bin.bin_id}`} className={styles.binLink}>
                          <strong>{bin.name || 'Unnamed'}</strong>
                        </Link>
                      </td>
                      <td>
                        <span className={`badge badge-${bin.bin_type?.toLowerCase() || 'general'}`}>
                          {bin.bin_type || 'general'}
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
                      <td>{formatDate(bin.last_updated)}</td>
                      <td>
                        <span className={`badge ${bin.is_active ? 'badge-active' : 'badge-inactive'}`}>
                          {bin.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <Link to={`/bins/${bin.bin_id}`} className={styles.actionBtn} title="View">
                            View
                          </Link>
                          <Link to={`/bins/${bin.bin_id}/edit`} className={styles.actionBtn} title="Edit">
                            Edit
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
    </div>
  )
}
