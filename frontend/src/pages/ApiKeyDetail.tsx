import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getApiKey, deleteApiKey, ApiKeyInfo } from '../api/client'
import LanguageSwitcher from '../components/LanguageSwitcher'
import styles from './ApiKeyDetail.module.css'

function formatDate(dateStr: string | null, neverText: string): string {
  if (!dateStr) return neverText
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ApiKeyDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [apiKey, setApiKey] = useState<ApiKeyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) {
      setError(t('apiKeys.noKeyId'))
      setLoading(false)
      return
    }

    const loadApiKey = async () => {
      try {
        const data = await getApiKey(id)
        setApiKey(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('apiKeys.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }

    loadApiKey()
  }, [id, t])

  const handleDelete = async () => {
    if (!apiKey || !id) return
    if (!window.confirm(t('apiKeys.deleteConfirm', { name: apiKey.name }))) return

    setDeleting(true)
    try {
      await deleteApiKey(id)
      navigate('/settings/api-keys')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('apiKeys.failedToDelete'))
      setDeleting(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/settings/api-keys" className={styles.backLink}>&larr; {t('apiKeys.backToList')}</Link>
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
        {loading ? (
          <div className={styles.loadingState}>
            <div className="spinner"></div>
            <p>{t('common.loading')}</p>
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : apiKey ? (
          <div className={styles.card}>
            <h2>{apiKey.name}</h2>

            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>{t('apiKeys.table.status')}</div>
              <div className={styles.detailValue}>
                <span className={`badge ${apiKey.is_active ? 'badge-active' : 'badge-inactive'}`}>
                  {apiKey.is_active ? t('common.active') : t('common.inactive')}
                </span>
              </div>
            </div>

            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>{t('apiKeys.table.prefix')}</div>
              <div className={styles.detailValue}><code>{apiKey.key_prefix}...</code></div>
            </div>

            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>{t('apiKeys.table.scopes')}</div>
              <div className={styles.detailValue}>
                {apiKey.scopes.map((s) => (
                  <span key={s} className={styles.scopeTag}>{s}</span>
                ))}
              </div>
            </div>

            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>Key ID</div>
              <div className={styles.detailValue}><code>{apiKey.key_id}</code></div>
            </div>

            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>{t('apiKeys.table.createdBy')}</div>
              <div className={styles.detailValue}>{apiKey.created_by}</div>
            </div>

            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>{t('apiKeys.createdAt')}</div>
              <div className={styles.detailValue}>{formatDate(apiKey.created_at, t('common.never'))}</div>
            </div>

            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>{t('apiKeys.table.lastUsed')}</div>
              <div className={styles.detailValue}>{formatDate(apiKey.last_used_at, t('common.never'))}</div>
            </div>

            {apiKey.expires_at && (
              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>{t('apiKeys.expires')}</div>
                <div className={styles.detailValue}>{formatDate(apiKey.expires_at, t('common.never'))}</div>
              </div>
            )}

            <div className={styles.cardActions}>
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
        ) : null}
      </main>
    </div>
  )
}
