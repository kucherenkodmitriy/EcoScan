import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useBreadcrumbs } from '../context/BreadcrumbContext'
import { ApiKeysContent } from './ApiKeyList'
import { WebhooksContent } from './WebhookList'
import { ExportContent } from './Export'
import UserList from './UserList'
import styles from './Settings.module.css'

export default function Settings() {
  const { t } = useTranslation()
  const location = useLocation()

  useBreadcrumbs([
    { label: t('breadcrumbs.dashboard'), path: '/dashboard' },
    { label: t('breadcrumbs.settings') },
  ])

  const getActiveSection = () => {
    if (location.pathname.includes('/settings/webhooks')) return 'webhooks'
    if (location.pathname.includes('/settings/export')) return 'export'
    if (location.pathname.includes('/settings/users')) return 'users'
    return 'api-keys'
  }

  const activeSection = getActiveSection()

  return (
    <>
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
    </>
  )
}
