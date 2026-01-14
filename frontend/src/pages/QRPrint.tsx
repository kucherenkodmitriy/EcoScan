import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getBins, Bin } from '../api/client'
import QRLabel from '../components/QRLabel'
import styles from './QRPrint.module.css'

const BIN_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'plastic', label: 'Plastic' },
  { value: 'paper', label: 'Paper' },
  { value: 'glass', label: 'Glass' },
]

const STATUS_FILTERS = [
  { value: '', label: 'All Status' },
  { value: 'full', label: 'Full (80%+)' },
  { value: 'filling', label: 'Filling (50-79%)' },
  { value: 'available', label: 'Available (<50%)' },
]

const ACTIVE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active Only' },
  { value: 'inactive', label: 'Inactive Only' },
]

export default function QRPrint() {
  const { user, logout } = useAuth()

  const [bins, setBins] = useState<Bin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('active')

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Preview modal
  const [previewBin, setPreviewBin] = useState<Bin | null>(null)

  // Print mode
  const [isPrintMode, setIsPrintMode] = useState(false)

  useEffect(() => {
    const loadBins = async () => {
      try {
        const data = await getBins()
        setBins(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bins')
      } finally {
        setLoading(false)
      }
    }
    loadBins()
  }, [])

  // Apply filters
  const filteredBins = bins.filter((bin) => {
    // Type filter
    if (typeFilter && bin.bin_type?.toLowerCase() !== typeFilter) {
      return false
    }

    // Status filter
    if (statusFilter) {
      const status = bin.status || 0
      if (statusFilter === 'full' && status < 80) return false
      if (statusFilter === 'filling' && (status < 50 || status >= 80)) return false
      if (statusFilter === 'available' && status >= 50) return false
    }

    // Active filter
    if (activeFilter === 'active' && !bin.is_active) return false
    if (activeFilter === 'inactive' && bin.is_active) return false

    return true
  })

  const selectedBins = filteredBins.filter((bin) => selectedIds.has(bin.bin_id))

  const toggleSelection = (binId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(binId)) {
        next.delete(binId)
      } else {
        next.add(binId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(filteredBins.map((b) => b.bin_id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const handlePrint = () => {
    setIsPrintMode(true)
    setTimeout(() => {
      window.print()
      setIsPrintMode(false)
    }, 100)
  }

  const handlePrintSingle = (bin: Bin) => {
    setPreviewBin(bin)
  }

  const printSingle = () => {
    if (!previewBin) return
    const temp = selectedIds
    setSelectedIds(new Set([previewBin.bin_id]))
    setIsPrintMode(true)
    setTimeout(() => {
      window.print()
      setIsPrintMode(false)
      setSelectedIds(temp)
      setPreviewBin(null)
    }, 100)
  }

  // Print view
  if (isPrintMode) {
    const binsToPrint = selectedBins.length > 0 ? selectedBins : (previewBin ? [previewBin] : [])
    return (
      <div className={styles.printContainer}>
        <div className={styles.printGrid}>
          {binsToPrint.map((bin) => (
            <div key={bin.bin_id} className={styles.printLabel}>
              <QRLabel bin={bin} size="large" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/dashboard" className={styles.backLink}>&larr; Dashboard</Link>
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
        <div className={styles.titleBar}>
          <h2>Print QR Codes</h2>
          <p className={styles.subtitle}>Select bins and print QR code labels for scanning</p>
        </div>

        {/* Filters */}
        <div className={styles.filterBar}>
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label htmlFor="typeFilter">Type</label>
              <select
                id="typeFilter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={styles.select}
              >
                {BIN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="statusFilter">Status</label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.select}
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="activeFilter">Active</label>
              <select
                id="activeFilter"
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className={styles.select}
              >
                {ACTIVE_FILTERS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.selectionActions}>
            <button className={styles.selectBtn} onClick={selectAll}>
              Select All ({filteredBins.length})
            </button>
            <button className={styles.selectBtn} onClick={deselectAll}>
              Deselect All
            </button>
          </div>
        </div>

        {/* Selection counter and print button */}
        <div className={styles.actionBar}>
          <span className={styles.counter}>
            {selectedIds.size} bin{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            className="btn btn-primary"
            onClick={handlePrint}
            disabled={selectedIds.size === 0}
          >
            Print Selected ({selectedIds.size})
          </button>
        </div>

        {/* Bin list */}
        <div className={styles.binList}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className="spinner"></div>
              <p>Loading bins...</p>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <p>{error}</p>
            </div>
          ) : filteredBins.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No bins match your filters.</p>
            </div>
          ) : (
            filteredBins.map((bin) => (
              <div
                key={bin.bin_id}
                className={`${styles.binItem} ${selectedIds.has(bin.bin_id) ? styles.selected : ''}`}
              >
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(bin.bin_id)}
                    onChange={() => toggleSelection(bin.bin_id)}
                  />
                  <div className={styles.binInfo}>
                    <strong>{bin.name || 'Unnamed'}</strong>
                    <span className={`badge badge-${bin.bin_type?.toLowerCase() || 'mixed'}`}>
                      {bin.bin_type || 'mixed'}
                    </span>
                    {bin.address && <span className={styles.address}>{bin.address}</span>}
                  </div>
                </label>
                <button
                  className={styles.previewBtn}
                  onClick={() => handlePrintSingle(bin)}
                  title="Preview QR"
                >
                  Preview
                </button>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Single QR Preview Modal */}
      {previewBin && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>QR Code Preview</h3>
            <div className={styles.previewLabel}>
              <QRLabel bin={previewBin} size="large" />
            </div>
            <div className={styles.modalActions}>
              <button
                className="btn btn-secondary"
                onClick={() => setPreviewBin(null)}
                style={{ background: '#666', border: 'none' }}
              >
                Close
              </button>
              <button className="btn btn-primary" onClick={printSingle}>
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
