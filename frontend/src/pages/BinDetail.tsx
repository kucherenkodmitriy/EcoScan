import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getBin, deleteBin, Bin } from '../api/client'
import styles from './BinDetail.module.css'

function getStatusClass(status: number): string {
  if (status >= 80) return styles.high
  if (status >= 50) return styles.medium
  return styles.low
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function BinDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [bin, setBin] = useState<Bin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!id) {
      setError('No bin ID provided')
      setLoading(false)
      return
    }

    const loadBin = async () => {
      try {
        const data = await getBin(id)
        setBin(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bin')
      } finally {
        setLoading(false)
      }
    }

    loadBin()
  }, [id])

  const handleDelete = async () => {
    if (!id) return

    setDeleting(true)
    try {
      await deleteBin(id)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bin')
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/dashboard" className={styles.backLink}>&larr; Back</Link>
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
        {loading ? (
          <div className={styles.loadingState}>
            <div className="spinner"></div>
            <p>Loading bin...</p>
          </div>
        ) : error && !bin ? (
          <div className={styles.errorState}>
            <p>{error}</p>
            <Link to="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
          </div>
        ) : bin ? (
          <>
            <div className={styles.titleBar}>
              <div>
                <h2>{bin.name || 'Unnamed Bin'}</h2>
                <span className={`badge badge-${bin.bin_type?.toLowerCase() || 'general'}`}>
                  {bin.bin_type || 'General'}
                </span>
                <span className={`badge ${bin.is_active ? 'badge-active' : 'badge-inactive'}`} style={{ marginLeft: 8 }}>
                  {bin.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className={styles.actions}>
                <Link to={`/bins/${id}/edit`} className="btn btn-primary">
                  Edit Bin
                </Link>
                <button
                  className={`btn ${styles.btnDanger}`}
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                >
                  Delete
                </button>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className={styles.grid}>
              <div className={styles.card}>
                <h3>Current Status</h3>
                <div className={`${styles.statusDisplay} ${getStatusClass(bin.current_fullness || 0)}`}>
                  <div className={styles.statusValue}>{bin.current_fullness || 0}%</div>
                  <div className={styles.statusBar}>
                    <div
                      className={styles.statusFill}
                      style={{ width: `${bin.current_fullness || 0}%` }}
                    ></div>
                  </div>
                  <div className={styles.statusLabel}>
                    {(bin.current_fullness || 0) >= 80
                      ? 'Full - Needs Collection'
                      : (bin.current_fullness || 0) >= 50
                      ? 'Getting Full'
                      : 'Available'}
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <h3>Details</h3>
                <dl className={styles.details}>
                  <dt>Bin ID</dt>
                  <dd><code>{bin.bin_id}</code></dd>
                  <dt>Address</dt>
                  <dd>{bin.address || '-'}</dd>
                  <dt>Total Reports</dt>
                  <dd>{bin.reports_count || 0}</dd>
                  <dt>Last Updated</dt>
                  <dd>{formatDate(bin.last_updated)}</dd>
                </dl>
              </div>

              <div className={styles.card}>
                <h3>QR Code Link</h3>
                <p className={styles.qrInfo}>
                  Scan QR code or share this link for public reporting:
                </p>
                <div className={styles.qrLink}>
                  <code>/report?bin={bin.bin_id}</code>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const url = `${window.location.origin}/report?bin=${bin.bin_id}`
                      navigator.clipboard.writeText(url)
                    }}
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>

            {showDeleteConfirm && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <h3>Delete Bin?</h3>
                  <p>Are you sure you want to delete "{bin.name}"? This action will soft-delete the bin.</p>
                  <div className={styles.modalActions}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      style={{ background: '#666', border: 'none' }}
                    >
                      Cancel
                    </button>
                    <button
                      className={`btn ${styles.btnDanger}`}
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
