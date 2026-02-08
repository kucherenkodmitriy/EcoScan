import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getApiKeys, deleteApiKey, ApiKeyInfo } from '../api/client'
import LanguageSwitcher from '../components/LanguageSwitcher'
import styles from './ApiKeyList.module.css'

function formatDate(dateStr: string | null, neverText: string): string {
  if (!dateStr) return neverText
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ApiKeysContent() {
  const { t } = useTranslation()
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadApiKeys = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getApiKeys()
      setApiKeys(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('apiKeys.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApiKeys()
  }, [])

  const handleDelete = async (apiKey: ApiKeyInfo) => {
    if (!window.confirm(t('apiKeys.deleteConfirm', { name: apiKey.name }))) return

    setDeletingId(apiKey.key_id)
    try {
      await deleteApiKey(apiKey.key_id)
      await loadApiKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('apiKeys.failedToDelete'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <h2>{t('apiKeys.title')}</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={loadApiKeys} disabled={loading} style={{ background: '#666', border: 'none' }}>
            {loading ? t('common.loading') : t('common.refresh')}
          </button>
          <Link to="/api-keys/new" className="btn btn-primary">
            {t('apiKeys.newApiKey')}
          </Link>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading && apiKeys.length === 0 ? (
        <div className={styles.loadingState}>
          <div className="spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('apiKeys.noApiKeys')}</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('apiKeys.table.name')}</th>
                <th>{t('apiKeys.table.prefix')}</th>
                <th>{t('apiKeys.table.scopes')}</th>
                <th>{t('apiKeys.table.status')}</th>
                <th>{t('apiKeys.table.createdBy')}</th>
                <th>{t('apiKeys.table.lastUsed')}</th>
                <th>{t('apiKeys.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((apiKey) => (
                <tr key={apiKey.key_id}>
                  <td>
                    <Link to={`/api-keys/${apiKey.key_id}`} className={styles.keyLink}>
                      <strong>{apiKey.name}</strong>
                    </Link>
                  </td>
                  <td>
                    <code className={styles.prefix}>{apiKey.key_prefix}...</code>
                  </td>
                  <td>
                    <div className={styles.scopes}>
                      {apiKey.scopes.map((s) => (
                        <span key={s} className={styles.scopeTag}>{s}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${apiKey.is_active ? 'badge-active' : 'badge-inactive'}`}>
                      {apiKey.is_active ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td>{apiKey.created_by}</td>
                  <td>{formatDate(apiKey.last_used_at, t('common.never'))}</td>
                  <td>
                    <div className={styles.actions}>
                      <Link to={`/api-keys/${apiKey.key_id}`} className={styles.actionBtn}>
                        {t('common.view')}
                      </Link>
                      <button
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => handleDelete(apiKey)}
                        disabled={deletingId === apiKey.key_id}
                      >
                        {deletingId === apiKey.key_id ? '...' : t('common.delete')}
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

export default function ApiKeyList() {
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
        <ApiKeysContent />
      </main>
    </div>
  )
}
