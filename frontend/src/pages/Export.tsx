import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getBins, type Bin } from '../api/client'
import styles from './Export.module.css'

function convertToCSV(bins: Bin[]): string {
  const headers = [
    'Bin ID',
    'Name',
    'Type',
    'Address',
    'Latitude',
    'Longitude',
    'Fullness (%)',
    'Reports Count',
    'Last Updated',
    'Status'
  ]

  const rows = bins.map(bin => [
    bin.bin_id,
    `"${(bin.name || '').replace(/"/g, '""')}"`,
    bin.bin_type,
    `"${(bin.address || '').replace(/"/g, '""')}"`,
    bin.coordinates?.latitude ?? '',
    bin.coordinates?.longitude ?? '',
    bin.status,
    bin.reports_count,
    bin.last_updated ? new Date(bin.last_updated).toISOString() : '',
    bin.is_active ? 'Active' : 'Inactive'
  ])

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

export function ExportContent() {
  const { t } = useTranslation()
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)
    setSuccess(false)

    try {
      const bins = await getBins()

      if (bins.length === 0) {
        setError(t('export.noData'))
        return
      }

      const csv = convertToCSV(bins)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `ecoscan-bins-${timestamp}.csv`

      downloadCSV(csv, filename)
      setSuccess(true)
    } catch (err) {
      setError(t('export.failed'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{t('export.title')}</h2>

      <div className={styles.card}>
        <div className={styles.description}>
          <p>{t('export.description')}</p>
          <ul className={styles.includeList}>
            <li>{t('export.includes.bins')}</li>
            <li>{t('export.includes.status')}</li>
            <li>{t('export.includes.location')}</li>
            <li>{t('export.includes.history')}</li>
          </ul>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="btn btn-primary"
        >
          {isExporting ? t('export.exporting') : t('export.downloadCSV')}
        </button>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {success && (
          <div className={styles.success}>
            {t('export.success')}
          </div>
        )}
      </div>
    </div>
  )
}
