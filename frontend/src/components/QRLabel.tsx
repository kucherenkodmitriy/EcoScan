import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { Bin } from '../api/client'
import styles from './QRLabel.module.css'

interface QRLabelProps {
  bin: Bin
  baseUrl?: string
  size?: 'small' | 'medium' | 'large' | 'fullpage'
}

export default function QRLabel({ bin, baseUrl, size = 'medium' }: QRLabelProps) {
  const { t } = useTranslation()
  const url = `${baseUrl || window.location.origin}/report?bin=${bin.bin_id}`

  // For fullpage, we want QR to fill A4 (~190mm usable = ~720px at 96dpi)
  const qrSize = size === 'fullpage' ? 720 : size === 'large' ? 200 : size === 'medium' ? 150 : 100

  // Full page mode - QR code fills entire A4 page
  if (size === 'fullpage') {
    return (
      <div className={styles.fullpage}>
        <QRCodeSVG
          value={url}
          size={1000}
          level="L"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    )
  }

  return (
    <div className={`${styles.label} ${styles[size]}`}>
      <div className={styles.qrCode}>
        <QRCodeSVG value={url} size={qrSize} level="M" />
      </div>
      <div className={styles.info}>
        <h3 className={styles.name}>{bin.name || t('binDetail.unnamed')}</h3>
        <span className={`badge badge-${bin.bin_type?.toLowerCase() || 'mixed'}`}>
          {t(`binTypes.${bin.bin_type?.toLowerCase() || 'mixed'}`)}
        </span>
        {bin.address && <p className={styles.address}>{bin.address}</p>}
        <p className={styles.scanText}>{t('qrLabel.scanToReport')}</p>
      </div>
    </div>
  )
}
