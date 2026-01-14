import { QRCodeSVG } from 'qrcode.react'
import { Bin } from '../api/client'
import styles from './QRLabel.module.css'

interface QRLabelProps {
  bin: Bin
  baseUrl?: string
  size?: 'small' | 'medium' | 'large'
}

export default function QRLabel({ bin, baseUrl, size = 'medium' }: QRLabelProps) {
  const url = `${baseUrl || window.location.origin}/report?bin=${bin.bin_id}`

  const qrSize = size === 'large' ? 200 : size === 'medium' ? 150 : 100

  return (
    <div className={`${styles.label} ${styles[size]}`}>
      <div className={styles.qrCode}>
        <QRCodeSVG value={url} size={qrSize} level="M" />
      </div>
      <div className={styles.info}>
        <h3 className={styles.name}>{bin.name || 'Unnamed Bin'}</h3>
        <span className={`badge badge-${bin.bin_type?.toLowerCase() || 'mixed'}`}>
          {bin.bin_type || 'mixed'}
        </span>
        {bin.address && <p className={styles.address}>{bin.address}</p>}
      </div>
    </div>
  )
}
