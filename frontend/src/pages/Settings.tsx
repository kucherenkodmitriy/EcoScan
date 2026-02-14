import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { ApiKeysContent } from './ApiKeyList'
import { WebhooksContent } from './WebhookList'
import { ExportContent } from './Export'
import UserList from './UserList'
import styles from './Settings.module.css'

export default function Settings() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const location = useLocation()

  const getActiveSection = () => {
    if (location.pathname.includes('/settings/webhooks')) return 'webhooks'
    if (location.pathname.includes('/settings/export')) return 'export'
    if (location.pathname.includes('/settings/users')) return 'users'
    return 'api-keys'
  }

  const activeSection = getActiveSection()

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
          <Link
            to="/settings/export"
            className={activeSection === 'export' ? styles.navItemActive : styles.navItem}
          >
            {t('settings.dataExport')}
          </Link>
          <Link
            to="/settings/users"
            className={activeSection === 'users' ? styles.navItemActive : styles.navItem}
          >
            {t('settings.users')}
          </Link>
        </nav>

        <main className={styles.content}>
          {activeSection === 'api-keys' && <ApiKeysContent />}
          {activeSection === 'webhooks' && <WebhooksContent />}
          {activeSection === 'export' && <ExportContent />}
          {activeSection === 'users' && <UserList />}
        </main>
      </div>
    </div>
  )
}
