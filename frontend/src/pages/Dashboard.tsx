import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getBins, Bin } from '../api/client'
import styles from './Dashboard.module.css'

function getStatusClass(status: number): string {
  if (status >= 80) return styles.high
  if (status >= 50) return styles.medium
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

  const loadBins = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getBins()
      // Sort by fullness descending
      data.sort((a, b) => (b.current_fullness || 0) - (a.current_fullness || 0))
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

  const activeBins = bins.filter((b) => b.is_active)
  const fullBins = activeBins.filter((b) => (b.current_fullness || 0) >= 80).length
  const fillingBins = activeBins.filter((b) => {
    const f = b.current_fullness || 0
    return f >= 50 && f < 80
  }).length
  const availableBins = activeBins.filter((b) => (b.current_fullness || 0) < 50).length

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
        <div className={styles.statsBar}>
          <div className={styles.statCard}>
            <h3>Total Bins</h3>
            <div className={styles.statValue}>{activeBins.length}</div>
          </div>
          <div className={`${styles.statCard} ${styles.critical}`}>
            <h3>Full (80%+)</h3>
            <div className={styles.statValue}>{fullBins}</div>
          </div>
          <div className={`${styles.statCard} ${styles.warning}`}>
            <h3>Filling (50-79%)</h3>
            <div className={styles.statValue}>{fillingBins}</div>
          </div>
          <div className={`${styles.statCard} ${styles.good}`}>
            <h3>Available (&lt;50%)</h3>
            <div className={styles.statValue}>{availableBins}</div>
          </div>
        </div>

        <div className={styles.sectionHeader}>
          <h2>Bins</h2>
          <div className={styles.headerActions}>
            <button className="btn btn-secondary" onClick={loadBins} disabled={loading} style={{ background: '#666', border: 'none' }}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <Link to="/bins/new" className="btn btn-primary">
              + New Bin
            </Link>
          </div>
        </div>

        <div className={styles.tableContainer}>
          {loading && bins.length === 0 ? (
            <div className={styles.loadingState}>
              <div className="spinner"></div>
              <p>Loading bins...</p>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <p>{error}</p>
              <button className="btn btn-primary" onClick={loadBins}>
                Try Again
              </button>
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
                      <div className={`${styles.statusBar} ${getStatusClass(bin.current_fullness || 0)}`}>
                        <div className={styles.bar}>
                          <div
                            className={styles.barFill}
                            style={{ width: `${bin.current_fullness || 0}%` }}
                          ></div>
                        </div>
                        <span className={styles.percent}>{bin.current_fullness || 0}%</span>
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
      </main>
    </div>
  )
}
