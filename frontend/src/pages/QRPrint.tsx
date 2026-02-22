import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { useBreadcrumbs } from '../context/BreadcrumbContext'
import { getBins, Bin } from '../api/client'
import QRLabel from '../components/QRLabel'
import styles from './QRPrint.module.css'

export default function QRPrint() {
  const { t } = useTranslation()

  useBreadcrumbs([
    { label: t('breadcrumbs.dashboard'), path: '/dashboard' },
    { label: t('breadcrumbs.printQR') },
  ])

  const BIN_TYPES = [
    { value: '', label: t('qrPrint.allTypes') },
    { value: 'mixed', label: t('binTypes.mixed') },
    { value: 'plastic', label: t('binTypes.plastic') },
    { value: 'paper', label: t('binTypes.paper') },
    { value: 'glass', label: t('binTypes.glass') },
  ]

  const STATUS_FILTERS = [
    { value: '', label: t('qrPrint.allStatus') },
    { value: 'full', label: t('qrPrint.full') },
    { value: 'filling', label: t('qrPrint.filling') },
    { value: 'available', label: t('qrPrint.available') },
  ]

  const ACTIVE_FILTERS = [
    { value: '', label: t('qrPrint.all') },
    { value: 'active', label: t('qrPrint.activeOnly') },
    { value: 'inactive', label: t('qrPrint.inactiveOnly') },
  ]

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
        setError(err instanceof Error ? err.message : t('binDetail.failedToLoad'))
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
                  <h1 className="qr-cta">{t('qrPrint.containerFullCTA')}</h1>
                  <QRCodeSVG
                    value={`${window.location.origin}/report?bin=${bin.bin_id}`}
                    size={550}
                    level="L"
                  />
                  <div className="qr-bin-info">
                    <span className="bin-name">{bin.name || t('qrPrint.unnamed')}</span>
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
                  {t('qrPrint.pageOf', { current: index + 1, total: binsToPrint.length })}
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
              {t('qrPrint.printNow')}
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
              {t('common.back')}
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
    <>
      <main className={styles.main}>
        <div className={styles.titleBar}>
          <h2>{t('qrPrint.title')}</h2>
          <p className={styles.subtitle}>{t('qrPrint.subtitle')}</p>
        </div>

        {/* Filters */}
        <div className={styles.filterBar}>
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label htmlFor="typeFilter">{t('qrPrint.filterType')}</label>
              <select
                id="typeFilter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={styles.select}
              >
                {BIN_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="statusFilter">{t('qrPrint.filterStatus')}</label>
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
              <label htmlFor="activeFilter">{t('qrPrint.filterActive')}</label>
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
              {t('qrPrint.selectAll')} ({filteredBins.length})
            </button>
            <button className={styles.selectBtn} onClick={deselectAll}>
              {t('qrPrint.deselectAll')}
            </button>
          </div>
        </div>

        {/* Selection counter and print button */}
        <div className={styles.actionBar}>
          <span className={styles.counter}>
            {t('qrPrint.binsSelected', { count: selectedIds.size })}
          </span>
          <div className={styles.printOptions}>
            <label className={styles.printModeToggle}>
              <input
                type="checkbox"
                checked={fullPageMode}
                onChange={(e) => setFullPageMode(e.target.checked)}
              />
              <span>{t('qrPrint.fullA4Page')}</span>
            </label>
            <button
              className="btn btn-primary"
              onClick={handlePrint}
              disabled={selectedIds.size === 0}
            >
              {t('qrPrint.printSelected')} ({selectedIds.size})
            </button>
          </div>
        </div>

        {/* Bin list */}
        <div className={styles.binList}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className="spinner"></div>
              <p>{t('qrPrint.loadingBins')}</p>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <p>{error}</p>
            </div>
          ) : filteredBins.length === 0 ? (
            <div className={styles.emptyState}>
              <p>{t('qrPrint.noMatchingBins')}</p>
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
                    <strong>{bin.name || t('qrPrint.unnamed')}</strong>
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
                  {t('qrPrint.preview')}
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
            <h3>{t('qrPrint.qrPreviewTitle')}</h3>
            <div className={styles.previewLabel}>
              <QRLabel bin={previewBin} size="large" />
            </div>
            <div className={styles.modalActions}>
              <button
                className="btn btn-secondary"
                onClick={() => setPreviewBin(null)}
                style={{ background: '#666', border: 'none' }}
              >
                {t('common.close')}
              </button>
              <button className="btn btn-primary" onClick={printSingle}>
                {t('common.print')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
