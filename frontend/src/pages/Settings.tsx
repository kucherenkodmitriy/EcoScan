import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { ApiKeysContent } from './ApiKeyList'
import { WebhooksContent } from './WebhookList'
import styles from './Settings.module.css'

export default function Settings() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const location = useLocation()

  const activeSection = location.pathname.includes('/settings/webhooks') ? 'webhooks' : 'api-keys'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/dashboard" className={styles.backLink}>&larr; {t('binDetail.backToDashboard')}</Link>
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

      <div className={styles.body}>
        <nav className={styles.sidebar}>
          <div className={styles.sidebarTitle}>{t('settings.title')}</div>
          <Link
            to="/settings/api-keys"
            className={activeSection === 'api-keys' ? styles.navItemActive : styles.navItem}
          >
            {t('settings.apiKeys')}
          </Link>
          <Link
            to="/settings/webhooks"
            className={activeSection === 'webhooks' ? styles.navItemActive : styles.navItem}
          >
            {t('settings.webhooks')}
          </Link>
        </nav>

        <main className={styles.content}>
          {activeSection === 'api-keys' ? <ApiKeysContent /> : <WebhooksContent />}
        </main>
      </div>
    </div>
  )
}
