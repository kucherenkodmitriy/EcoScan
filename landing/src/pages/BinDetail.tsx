import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getBin, deleteBin, Bin } from '../api/client'
import QRLabel from '../components/QRLabel'
import LanguageSwitcher from '../components/LanguageSwitcher'
import styles from './BinDetail.module.css'

function getStatusClass(status: number): string {
  if (status >= 80) return styles.high
  if (status >= 50) return styles.medium
  return styles.low
}

function formatDate(dateStr: string | null, neverText: string): string {
  if (!dateStr) return neverText
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function BinDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [bin, setBin] = useState<Bin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showQRPreview, setShowQRPreview] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  useEffect(() => {
    if (!id) {
      setError(t('report.noBinId'))
      setLoading(false)
      return
    }

    const loadBin = async () => {
      try {
        const data = await getBin(id)
        setBin(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('binDetail.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }

    loadBin()
  }, [id, t])

  const handleDelete = async () => {
    if (!id) return

    setDeleting(true)
    try {
      await deleteBin(id)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('binDetail.failedToDelete'))
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handlePrintQR = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
      setShowQRPreview(false)
    }, 100)
  }

  const getStatusLabel = (status: number): string => {
    if (status >= 80) return t('binDetail.statusFull')
    if (status >= 50) return t('binDetail.statusGettingFull')
    return t('binDetail.statusAvailable')
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/dashboard" className={styles.backLink}>&larr; {t('common.back')}</Link>
          <h1>{t('common.appName')}</h1>
        </div>
        <div className={styles.headerRight}>
          <LanguageSwitcher />
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
        {loading ? (
          <div className={styles.loadingState}>
            <div className="spinner"></div>
            <p>{t('binDetail.loadingBin')}</p>
          </div>
        ) : error && !bin ? (
          <div className={styles.errorState}>
            <p>{error}</p>
            <Link to="/dashboard" className="btn btn-primary">{t('binDetail.backToDashboard')}</Link>
          </div>
        ) : bin ? (
          <>
            <div className={styles.titleBar}>
              <div>
                <h2>{bin.name || t('binDetail.unnamed')}</h2>
                <span className={`badge badge-${bin.bin_type?.toLowerCase() || 'general'}`}>
                  {t(`binTypes.${bin.bin_type?.toLowerCase() || 'general'}`)}
                </span>
                <span className={`badge ${bin.is_active ? 'badge-active' : 'badge-inactive'}`} style={{ marginLeft: 8 }}>
                  {bin.is_active ? t('common.active') : t('common.inactive')}
                </span>
              </div>
              <div className={styles.actions}>
                <Link to={`/bins/${id}/edit`} className="btn btn-primary">
                  {t('binDetail.editBin')}
                </Link>
                <button
                  className={`btn ${styles.btnDanger}`}
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className={styles.grid}>
              <div className={styles.card}>
                <h3>{t('binDetail.currentStatus')}</h3>
                <div className={`${styles.statusDisplay} ${getStatusClass(bin.status || 0)}`}>
                  <div className={styles.statusValue}>{bin.status || 0}%</div>
                  <div className={styles.statusBar}>
                    <div
                      className={styles.statusFill}
                      style={{ width: `${bin.status || 0}%` }}
                    ></div>
                  </div>
                  <div className={styles.statusLabel}>
                    {getStatusLabel(bin.status || 0)}
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <h3>{t('binDetail.details')}</h3>
                <dl className={styles.details}>
                  <dt>{t('binDetail.binId')}</dt>
                  <dd><code>{bin.bin_id}</code></dd>
                  <dt>{t('binDetail.address')}</dt>
                  <dd>{bin.address || '-'}</dd>
                  <dt>{t('binDetail.totalReports')}</dt>
                  <dd>{bin.reports_count || 0}</dd>
                  <dt>{t('binDetail.lastUpdated')}</dt>
                  <dd>{formatDate(bin.last_updated, t('common.never'))}</dd>
                </dl>
              </div>

              <div className={styles.card}>
                <h3>{t('binDetail.qrCode')}</h3>
                <p className={styles.qrInfo}>
                  {t('binDetail.qrInfo')}
                </p>
                <div className={styles.qrActions}>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowQRPreview(true)}
                  >
                    {t('binDetail.previewPrintQR')}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      const url = `${window.location.origin}/report?bin=${bin.bin_id}`
                      navigator.clipboard.writeText(url)
                    }}
                    style={{ background: '#666', border: 'none' }}
                  >
                    {t('binDetail.copyLink')}
                  </button>
                </div>
                <div className={styles.qrLink}>
                  <code>/report?bin={bin.bin_id}</code>
                </div>
              </div>
            </div>

            {showDeleteConfirm && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <h3>{t('binDetail.deleteBin')}</h3>
                  <p>{t('binDetail.deleteConfirm', { name: bin.name })}</p>
                  <div className={styles.modalActions}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      style={{ background: '#666', border: 'none' }}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      className={`btn ${styles.btnDanger}`}
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? t('binDetail.deleting') : t('common.delete')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showQRPreview && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <h3>{t('binDetail.qrPreview')}</h3>
                  <div className={styles.qrPreview}>
                    <QRLabel bin={bin} size="large" />
                  </div>
                  <div className={styles.modalActions}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowQRPreview(false)}
                      style={{ background: '#666', border: 'none' }}
                    >
                      {t('common.close')}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handlePrintQR}
                    >
                      {t('common.print')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isPrinting && (
              <div className={styles.printContainer}>
                <div className={styles.printLabel}>
                  <QRLabel bin={bin} size="large" />
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
