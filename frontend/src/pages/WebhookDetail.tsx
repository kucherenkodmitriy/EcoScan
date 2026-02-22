import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getWebhook, deleteWebhook, WebhookInfo } from '../api/client'
import { useBreadcrumbs } from '../context/BreadcrumbContext'
import styles from './WebhookDetail.module.css'

function formatDate(dateStr: string | null, neverText: string): string {
  if (!dateStr) return neverText
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function WebhookDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [webhook, setWebhook] = useState<WebhookInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useBreadcrumbs([
    { label: t('breadcrumbs.dashboard'), path: '/dashboard' },
    { label: t('breadcrumbs.settings'), path: '/settings/webhooks' },
    { label: webhook?.name || t('common.loading') },
  ])

  useEffect(() => {
    if (!id) {
      setError(t('webhooks.noWebhookId'))
      setLoading(false)
      return
    }

    const loadWebhook = async () => {
      try {
        const data = await getWebhook(id)
        setWebhook(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('webhooks.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }

    loadWebhook()
  }, [id, t])

  const handleDelete = async () => {
    if (!webhook || !id) return
    if (!window.confirm(t('webhooks.deleteConfirm', { name: webhook.name }))) return

    setDeleting(true)
    try {
      await deleteWebhook(id)
      navigate('/settings/webhooks')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('webhooks.failedToDelete'))
      setDeleting(false)
    }
  }

  return (
    <>
      <main className={styles.main}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className="spinner"></div>
            <p>{t('common.loading')}</p>
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : webhook ? (
          <>
            <div className={styles.card}>
              <h2>{webhook.name}</h2>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>{t('webhooks.table.status')}</div>
                <div className={styles.detailValue}>
                  <span className={`badge ${webhook.is_active ? 'badge-active' : 'badge-inactive'}`}>
                    {webhook.is_active ? t('common.active') : t('common.inactive')}
                  </span>
                </div>
              </div>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>{t('webhooks.table.url')}</div>
                <div className={styles.detailValue}><code>{webhook.url}</code></div>
              </div>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>{t('webhooks.form.authType')}</div>
                <div className={styles.detailValue}>{webhook.auth_type}</div>
              </div>

              {webhook.auth_header && (
                <div className={styles.detailRow}>
                  <div className={styles.detailLabel}>{t('webhooks.form.authHeader')}</div>
                  <div className={styles.detailValue}><code>{webhook.auth_header}</code></div>
                </div>
              )}

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>{t('webhooks.form.events')}</div>
                <div className={styles.detailValue}>
                  {webhook.events.length > 0
                    ? webhook.events.map((e) => (
                        <span key={e} className={styles.eventTag}>{e}</span>
                      ))
                    : t('webhooks.allEvents')}
                </div>
              </div>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Webhook ID</div>
                <div className={styles.detailValue}><code>{webhook.webhook_id}</code></div>
              </div>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>{t('webhooks.createdAt')}</div>
                <div className={styles.detailValue}>{formatDate(webhook.created_at, t('common.never'))}</div>
              </div>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>{t('webhooks.updatedAt')}</div>
                <div className={styles.detailValue}>{formatDate(webhook.updated_at, t('common.never'))}</div>
              </div>

              <div className={styles.cardActions}>
                <Link to={`/webhooks/${webhook.webhook_id}/edit`} className="btn btn-primary">
                  {t('common.edit')}
                </Link>
                <button
                  className={`btn ${styles.deleteBtn}`}
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ color: 'white' }}
                >
                  {deleting ? '...' : t('common.delete')}
                </button>
              </div>
            </div>

            <div className={styles.card}>
              <h3>{t('webhooks.deliveryStats')}</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <div className={styles.label}>{t('webhooks.successCount')}</div>
                  <div className={`${styles.value} ${styles.successValue}`}>{webhook.success_count}</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.label}>{t('webhooks.failureCount')}</div>
                  <div className={`${styles.value} ${styles.failureValue}`}>{webhook.failure_count}</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.label}>{t('webhooks.table.lastTriggered')}</div>
                  <div className={styles.value} style={{ fontSize: '14px' }}>
                    {formatDate(webhook.last_triggered_at, t('common.never'))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </>
  )
}
