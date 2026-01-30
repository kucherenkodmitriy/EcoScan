import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { getBins, Bin } from '../api/client'
import QRLabel from '../components/QRLabel'
import styles from './QRPrint.module.css'

// Component to render full-page QR
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

  // Full page mode (one QR per A4 page)
  const [fullPageMode, setFullPageMode] = useState(false)

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
    return !(activeFilter === 'inactive' && bin.is_active);


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
    if (!fullPageMode) {
      // For grid mode, print immediately
      setTimeout(() => {
        window.print()
        setIsPrintMode(false)
      }, 100)
    }
    // For full page mode, show preview first - user can press Ctrl+P
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

    // Full page mode - one QR per A4 page, QR fills entire page
    if (fullPageMode) {
      return (
        <div style={{ background: '#eee', padding: '20px' }}>
          <style>{`
            .qr-page {
              width: 210mm;
              height: 297mm;
              display: flex;
              align-items: center;
              justify-content: center;
              background: white;
              box-sizing: border-box;
              margin: 0 auto 20px auto;
              box-shadow: 0 2px 10px rgba(0,0,0,0.2);
              position: relative;
            }
            .qr-content {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 10px;
              padding: 20px;
            }
            .qr-cta {
              font-size: 48px;
              font-weight: 700;
              color: #2e7d32;
              margin: 0 0 30px 0;
              text-align: center;
            }
            .qr-bin-info {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
              margin-top: 10px;
            }
            .bin-name {
              font-size: 24px;
              font-weight: 600;
              color: #333;
            }
            .bin-type {
              font-size: 18px;
              color: #666;
              text-transform: capitalize;
            }
            .bin-address {
              font-size: 16px;
              color: #888;
            }
            @media print {
              @page {
                size: A4 portrait;
                margin: 0;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
              .no-print {
                display: none !important;
              }
              .qr-page-container {
                padding: 0 !important;
                background: white !important;
              }
              .qr-page {
                margin: 0;
                box-shadow: none;
                page-break-after: always;
                break-after: page;
              }
              .qr-page:last-child {
                page-break-after: auto;
                break-after: auto;
              }
            }
          `}</style>
          <div className="qr-page-container">
            {binsToPrint.map((bin, index) => (
              <div key={bin.bin_id} className="qr-page">
                <div className="qr-content">
                  <h1 className="qr-cta">Container full? Scan and report!</h1>
                  <QRCodeSVG
                    value={`${window.location.origin}/report?bin=${bin.bin_id}`}
                    size={550}
                    level="L"
                  />
                  <div className="qr-bin-info">
                    <span className="bin-name">{bin.name || 'Unnamed Bin'}</span>
                    {bin.bin_type && <span className="bin-type">{bin.bin_type}</span>}
                    {bin.address && <span className="bin-address">{bin.address}</span>}
                  </div>
                </div>
                <div className="page-number no-print" style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  fontSize: '14px',
                  color: '#666'
                }}>
                  Page {index + 1} of {binsToPrint.length}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              position: 'fixed',
              top: 20,
              right: 20,
              display: 'flex',
              gap: '10px',
              zIndex: 1000
            }}
            className="no-print"
          >
            <button
              onClick={() => window.print()}
              style={{
                padding: '10px 20px',
                background: '#2e7d32',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Print Now
            </button>
            <button
              onClick={() => setIsPrintMode(false)}
              style={{
                padding: '10px 20px',
                background: '#333',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
          </div>
        </div>
      )
    }

    // Grid mode - 4 per page
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
          <div className={styles.printOptions}>
            <label className={styles.printModeToggle}>
              <input
                type="checkbox"
                checked={fullPageMode}
                onChange={(e) => setFullPageMode(e.target.checked)}
              />
              <span>Full A4 page</span>
            </label>
            <button
              className="btn btn-primary"
              onClick={handlePrint}
              disabled={selectedIds.size === 0}
            >
              Print Selected ({selectedIds.size})
            </button>
          </div>
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
