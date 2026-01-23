import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getPublicBinInfo, submitBinStatus, PublicBinInfo } from '../api/client'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Footer from '../components/Footer'
import styles from './Report.module.css'

function getStatusColor(value: number): string {
  if (value <= 50) return '#4caf50'
  if (value <= 75) return '#ff9800'
  return '#f44336'
}

export default function Report() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const binId = searchParams.get('bin')

  const [bin, setBin] = useState<PublicBinInfo | null>(null)
  const [status, setStatus] = useState(50)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const getStatusText = (value: number): string => {
    if (value <= 20) return t('report.statusNearlyEmpty')
    if (value <= 40) return t('report.statusLessThanHalf')
    if (value <= 60) return t('report.statusAboutHalf')
    if (value <= 80) return t('report.statusGettingFull')
    return t('report.statusAlmostFull')
  }

  useEffect(() => {
    if (!binId) {
      setError(t('report.noBinId'))
      setLoading(false)
      return
    }

    const loadBin = async () => {
      try {
        const data = await getPublicBinInfo(binId)
        setBin(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('report.binNotFound'))
      } finally {
        setLoading(false)
      }
    }

    loadBin()
  }, [binId, t])

  const handleSubmit = async () => {
    if (!binId) return

    setSubmitting(true)
    setError('')

    try {
      await submitBinStatus(binId, status)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('report.failedToSubmit'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.languageSwitcher}>
          <div className="language-switcher-light">
            <LanguageSwitcher />
          </div>
        </div>
        <div className={styles.card}>
          <div className="spinner"></div>
          <p style={{ textAlign: 'center', marginTop: 16, color: '#666' }}>{t('common.loading')}</p>
        </div>
        <Footer variant="light" />
      </div>
    )
  }

  if (error && !bin) {
    return (
      <div className={styles.container}>
        <div className={styles.languageSwitcher}>
          <div className="language-switcher-light">
            <LanguageSwitcher />
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.errorIcon}>!</div>
          <h2 className={styles.errorTitle}>{t('common.error')}</h2>
          <p className={styles.errorText}>{error}</p>
        </div>
        <Footer variant="light" />
      </div>
    )
  }

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.languageSwitcher}>
          <div className="language-switcher-light">
            <LanguageSwitcher />
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.successIcon}>&#10003;</div>
          <h2 className={styles.successTitle}>{t('report.thankYou')}</h2>
          <p className={styles.successText}>{t('report.successMessage')}</p>
        </div>
        <Footer variant="light" />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.languageSwitcher}>
        <div className="language-switcher-light">
          <LanguageSwitcher />
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>{t('common.appName')}</h1>
          <p>{t('report.title')}</p>
        </div>

        {bin && (
          <div className={styles.binInfo}>
            <h2>{bin.name}</h2>
            <span className={`badge badge-${bin.bin_type?.toLowerCase() || 'general'}`}>
              {t(`binTypes.${bin.bin_type?.toLowerCase() || 'general'}`)}
            </span>
            {bin.address && <p className={styles.address}>{bin.address}</p>}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className={styles.sliderSection}>
          <label>{t('report.howFull')}</label>
          <div className={styles.statusDisplay}>
            <span className={styles.statusText} style={{ color: getStatusColor(status) }}>
              {getStatusText(status)}
            </span>
            <span className={styles.statusPercent}>{status}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={status}
            onChange={(e) => setStatus(parseInt(e.target.value))}
            className={styles.slider}
            style={{
              background: `linear-gradient(to right, ${getStatusColor(status)} 0%, ${getStatusColor(status)} ${status}%, #e0e0e0 ${status}%, #e0e0e0 100%)`,
            }}
          />
          <div className={styles.sliderLabels}>
            <span>{t('report.empty')}</span>
            <span>{t('report.full')}</span>
          </div>
        </div>

        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? t('report.submitting') : t('report.submitReport')}
        </button>
      </div>
      <Footer variant="light" />
    </div>
  )
}
