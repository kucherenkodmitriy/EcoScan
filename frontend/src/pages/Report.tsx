import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPublicBinInfo, submitBinStatus, PublicBinInfo } from '../api/client'
import styles from './Report.module.css'

function getStatusText(value: number): string {
  if (value <= 20) return 'Nearly empty'
  if (value <= 40) return 'Less than half'
  if (value <= 60) return 'About half full'
  if (value <= 80) return 'Getting full'
  return 'Almost full'
}

function getStatusColor(value: number): string {
  if (value <= 50) return '#4caf50'
  if (value <= 75) return '#ff9800'
  return '#f44336'
}

export default function Report() {
  const [searchParams] = useSearchParams()
  const binId = searchParams.get('bin')

  const [bin, setBin] = useState<PublicBinInfo | null>(null)
  const [status, setStatus] = useState(50)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!binId) {
      setError('No bin ID provided')
      setLoading(false)
      return
    }

    const loadBin = async () => {
      try {
        const data = await getPublicBinInfo(binId)
        setBin(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bin not found')
      } finally {
        setLoading(false)
      }
    }

    loadBin()
  }, [binId])

  const handleSubmit = async () => {
    if (!binId) return

    setSubmitting(true)
    setError('')

    try {
      await submitBinStatus(binId, status)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className="spinner"></div>
          <p style={{ textAlign: 'center', marginTop: 16, color: '#666' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (error && !bin) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorIcon}>!</div>
          <h2 className={styles.errorTitle}>Error</h2>
          <p className={styles.errorText}>{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.successIcon}>&#10003;</div>
          <h2 className={styles.successTitle}>Thank You!</h2>
          <p className={styles.successText}>Your report has been submitted successfully.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>EcoScan</h1>
          <p>Report Bin Status</p>
        </div>

        {bin && (
          <div className={styles.binInfo}>
            <h2>{bin.name}</h2>
            <span className={`badge badge-${bin.bin_type?.toLowerCase() || 'general'}`}>
              {bin.bin_type || 'General'}
            </span>
            {bin.address && <p className={styles.address}>{bin.address}</p>}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className={styles.sliderSection}>
          <label>How full is this bin?</label>
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
            <span>Empty</span>
            <span>Full</span>
          </div>
        </div>

        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    </div>
  )
}
