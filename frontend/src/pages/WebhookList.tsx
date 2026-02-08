import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getWebhooks, deleteWebhook, WebhookInfo } from '../api/client'
import LanguageSwitcher from '../components/LanguageSwitcher'
import styles from './WebhookList.module.css'

function formatDate(dateStr: string | null, neverText: string): string {
  if (!dateStr) return neverText
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function WebhooksContent() {
  const { t } = useTranslation()
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadWebhooks = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getWebhooks()
      setWebhooks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('webhooks.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWebhooks()
  }, [])

  const handleDelete = async (webhook: WebhookInfo) => {
    if (!window.confirm(t('webhooks.deleteConfirm', { name: webhook.name }))) return

    setDeletingId(webhook.webhook_id)
    try {
      await deleteWebhook(webhook.webhook_id)
      await loadWebhooks()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('webhooks.failedToDelete'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <h2>{t('webhooks.title')}</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={loadWebhooks} disabled={loading} style={{ background: '#666', border: 'none' }}>
            {loading ? t('common.loading') : t('common.refresh')}
          </button>
          <Link to="/webhooks/new" className="btn btn-primary">
            {t('webhooks.newWebhook')}
          </Link>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading && webhooks.length === 0 ? (
        <div className={styles.loadingState}>
          <div className="spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      ) : webhooks.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('webhooks.noWebhooks')}</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('webhooks.table.name')}</th>
                <th>{t('webhooks.table.url')}</th>
                <th>{t('webhooks.table.status')}</th>
                <th>{t('webhooks.table.deliveries')}</th>
                <th>{t('webhooks.table.lastTriggered')}</th>
                <th>{t('webhooks.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((webhook) => (
                <tr key={webhook.webhook_id}>
                  <td>
                    <Link to={`/webhooks/${webhook.webhook_id}`} className={styles.webhookLink}>
                      <strong>{webhook.name}</strong>
                    </Link>
                  </td>
                  <td>
                    <div className={styles.urlCell}>{webhook.url}</div>
                  </td>
                  <td>
                    <span className={`badge ${webhook.is_active ? 'badge-active' : 'badge-inactive'}`}>
                      {webhook.is_active ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td>
                    <div className={styles.stats}>
                      <span className={styles.successCount}>{webhook.success_count} ok</span>
                      <span className={styles.failureCount}>{webhook.failure_count} fail</span>
                    </div>
                  </td>
                  <td>{formatDate(webhook.last_triggered_at, t('common.never'))}</td>
                  <td>
                    <div className={styles.actions}>
                      <Link to={`/webhooks/${webhook.webhook_id}`} className={styles.actionBtn}>
                        {t('common.view')}
                      </Link>
                      <Link to={`/webhooks/${webhook.webhook_id}/edit`} className={styles.actionBtn}>
                        {t('common.edit')}
                      </Link>
                      <button
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => handleDelete(webhook)}
                        disabled={deletingId === webhook.webhook_id}
                      >
                        {deletingId === webhook.webhook_id ? '...' : t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default function WebhookList() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

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

      <main className={styles.main}>
        <WebhooksContent />
      </main>
    </div>
  )
}
