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

  // Print view — A4 full page mode (one QR per page)
  if (isPrintMode) {
    const binsToPrint = selectedBins.length > 0 ? selectedBins : (previewBin ? [previewBin] : [])

    return (
      <div className={styles.printPreview}>
        <div className={styles.printToolbar}>
          <button
            className="btn btn-primary"
            onClick={() => window.print()}
          >
            {t('qrPrint.printNow')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setIsPrintMode(false)}
            style={{ background: '#666', border: 'none' }}
          >
            {t('common.back')}
          </button>
        </div>
        <style>{`
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
          }
        `}</style>
        <div className={styles.printPages}>
          {binsToPrint.map((bin, index) => (
            <div key={bin.bin_id} className={styles.printPage}>
              <div className={styles.printPageContent}>
                <h1 className={styles.printCTA}>{t('qrPrint.containerFullCTA')}</h1>
                <QRCodeSVG
                  value={`${window.location.origin}/report?bin=${bin.bin_id}`}
                  size={550}
                  level="L"
                />
                <div className={styles.printBinInfo}>
                  <span className={styles.printBinName}>{bin.name || t('qrPrint.unnamed')}</span>
                  {bin.bin_type && <span className={styles.printBinType}>{bin.bin_type}</span>}
                  {bin.address && <span className={styles.printBinAddress}>{bin.address}</span>}
                </div>
              </div>
              <div className={styles.printPageNumber}>
                {t('qrPrint.pageOf', { current: index + 1, total: binsToPrint.length })}
              </div>
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
          <button
            className="btn btn-primary"
            onClick={handlePrint}
            disabled={selectedIds.size === 0}
          >
            {t('qrPrint.printSelected')} ({selectedIds.size})
          </button>
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
