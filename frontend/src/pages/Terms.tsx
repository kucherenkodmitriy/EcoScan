import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '../components/SEO'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Footer from '../components/Footer'
import styles from './Legal.module.css'

export default function Terms() {
  const { t } = useTranslation()

  return (
    <div className={styles.container}>
      <SEO titleKey="meta.terms.title" descriptionKey="meta.terms.description" canonical="https://ecoscan.city/terms" />
      <div className={styles.languageSwitcher}>
        <LanguageSwitcher />
      </div>
      
      <div className={styles.content}>
        <Link to="/" className={styles.backLink}>
          ← {t('common.back')}
        </Link>
        
        <h1 className={styles.title}>{t('terms.title')}</h1>
        <p className={styles.lastUpdated}>{t('terms.lastUpdated')}: 2026-01-20</p>
        
        <div className={styles.disclaimerBox}>
          <p>{t('terms.demoWarning')}</p>
        </div>
        
        <section className={styles.section}>
          <h2>{t('terms.acceptanceTitle')}</h2>
          <p>{t('terms.acceptanceText')}</p>
        </section>
        
        <section className={styles.section}>
          <h2>{t('terms.demoTitle')}</h2>
          <p>{t('terms.demoText')}</p>
          <ul className={styles.list}>
            <li>{t('terms.demoItem1')}</li>
            <li>{t('terms.demoItem2')}</li>
            <li>{t('terms.demoItem3')}</li>
            <li>{t('terms.demoItem4')}</li>
          </ul>
        </section>
        
        <section className={styles.section}>
          <h2>{t('terms.disclaimerTitle')}</h2>
          <div className={styles.highlight}>
            <p>{t('terms.disclaimerHighlight')}</p>
          </div>
          <p>{t('terms.disclaimerText')}</p>
        </section>
        
        <section className={styles.section}>
          <h2>{t('terms.limitationTitle')}</h2>
          <p>{t('terms.limitationText')}</p>
        </section>
        
        <section className={styles.section}>
          <h2>{t('terms.noWarrantyTitle')}</h2>
          <p>{t('terms.noWarrantyText')}</p>
        </section>
        
        <section className={styles.section}>
          <h2>{t('terms.useAtOwnRiskTitle')}</h2>
          <p>{t('terms.useAtOwnRiskText')}</p>
        </section>
        
        <section className={styles.section}>
          <h2>{t('terms.changesTitle')}</h2>
          <p>{t('terms.changesText')}</p>
        </section>
      </div>
      
      <Footer variant="light" />
    </div>
  )
}
