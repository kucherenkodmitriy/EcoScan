import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '../components/SEO'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Footer from '../components/Footer'
import styles from './Legal.module.css'

export default function PrivacyPolicy() {
  const { t } = useTranslation()

  return (
    <div className={styles.container}>
      <SEO titleKey="meta.privacy.title" descriptionKey="meta.privacy.description" canonical="https://ecoscan.city/privacy" />
      <div className={styles.languageSwitcher}>
        <LanguageSwitcher />
      </div>
      
      <div className={styles.content}>
        <Link to="/" className={styles.backLink}>
          ← {t('common.back')}
        </Link>
        
        <h1 className={styles.title}>{t('privacy.title')}</h1>
        <p className={styles.lastUpdated}>{t('privacy.lastUpdated')}: 2026-01-20</p>
        
        <section className={styles.section}>
          <h2>{t('privacy.introTitle')}</h2>
          <p>{t('privacy.introText')}</p>
        </section>
        
        <section className={styles.section}>
          <h2>{t('privacy.dataCollectionTitle')}</h2>
          <p>{t('privacy.dataCollectionText')}</p>
          <ul className={styles.list}>
            <li>{t('privacy.dataItem1')}</li>
            <li>{t('privacy.dataItem2')}</li>
            <li>{t('privacy.dataItem3')}</li>
          </ul>
        </section>
        
        <section className={styles.section}>
          <h2>{t('privacy.noPersonalDataTitle')}</h2>
          <p>{t('privacy.noPersonalDataText')}</p>
        </section>
        
        <section className={styles.section}>
          <h2>{t('privacy.cookiesTitle')}</h2>
          <p>{t('privacy.cookiesText')}</p>
        </section>
        
        <section className={styles.section}>
          <h2>{t('privacy.thirdPartyTitle')}</h2>
          <p>{t('privacy.thirdPartyText')}</p>
        </section>
        
        <section className={styles.section}>
          <h2>{t('privacy.contactTitle')}</h2>
          <p>{t('privacy.contactText')}</p>
        </section>
      </div>
      
      <Footer variant="light" />
    </div>
  )
}
