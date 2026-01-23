import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bin } from '../../api/client'
import styles from './BinMap.module.css'

interface BinInfoWindowProps {
  bin: Bin
}

export default function BinInfoWindow({ bin }: BinInfoWindowProps) {
  const { t } = useTranslation()
  const statusColor = bin.status >= 70 ? '#c62828' : bin.status >= 30 ? '#f57c00' : '#2e7d32'

  return (
    <div className={styles.infoWindow}>
      <h4 className={styles.infoTitle}>{bin.name}</h4>
      <div className={styles.infoDetails}>
        <span className={`badge badge-${bin.bin_type?.toLowerCase() || 'mixed'}`}>
          {t(`binTypes.${bin.bin_type?.toLowerCase() || 'mixed'}`)}
        </span>
        <div className={styles.infoStatus} style={{ color: statusColor }}>
          <strong>{bin.status || 0}%</strong>
        </div>
      </div>
      {bin.address && <p className={styles.infoAddress}>{bin.address}</p>}
      <Link to={`/bins/${bin.bin_id}`} className={styles.infoLink}>
        {t('map.viewDetails')} →
      </Link>
    </div>
  )
}
