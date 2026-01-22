import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './Footer.module.css'

interface FooterProps {
  variant?: 'light' | 'dark'
}

export default function Footer({ variant = 'dark' }: FooterProps) {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className={`${styles.footer} ${styles[variant]}`}>
      <div className={styles.content}>
        <div className={styles.links}>
          <Link to="/privacy" className={styles.link}>
            {t('footer.privacy')}
          </Link>
          <span className={styles.separator}>|</span>
          <Link to="/terms" className={styles.link}>
            {t('footer.terms')}
          </Link>
        </div>
        <div className={styles.copyright}>
          © {currentYear} EcoScan. {t('footer.demoNotice')}
        </div>
      </div>
    </footer>
  )
}
