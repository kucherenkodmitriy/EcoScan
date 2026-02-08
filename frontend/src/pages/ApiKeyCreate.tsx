import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { createApiKey, ApiKeyCreatedResponse } from '../api/client'
import LanguageSwitcher from '../components/LanguageSwitcher'
import styles from './ApiKeyCreate.module.css'

const AVAILABLE_SCOPES = [
  { value: 'bins:read', label: 'bins:read' },
  { value: 'bins:write', label: 'bins:write' },
]

export default function ApiKeyCreate() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['bins:read'])
  const [expiresIn, setExpiresIn] = useState('')

  const handleScopeToggle = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError(t('apiKeys.nameRequired'))
      return
    }

    if (scopes.length === 0) {
      setError(t('apiKeys.scopeRequired'))
      return
    }

    setSaving(true)

    try {
      let expiresAt: string | undefined
      if (expiresIn) {
        const days = parseInt(expiresIn, 10)
        if (days > 0) {
          const expiry = new Date()
          expiry.setDate(expiry.getDate() + days)
          expiresAt = expiry.toISOString()
        }
      }

      const result = await createApiKey({
        name: name.trim(),
        scopes,
        expires_at: expiresAt,
      })
      setCreatedKey(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('apiKeys.failedToCreate'))
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    if (!createdKey) return
    try {
      await navigator.clipboard.writeText(createdKey.api_key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = createdKey.api_key
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (createdKey) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <Link to="/api-keys" className={styles.backLink}>&larr; {t('apiKeys.backToList')}</Link>
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
          <div className={styles.formCard}>
            <h2>{t('apiKeys.createdTitle')}</h2>

            <div className={styles.warningBox}>
              <strong>{t('apiKeys.keyWarningTitle')}</strong>
              <p>{t('apiKeys.keyWarningMessage')}</p>
            </div>

            <div className={styles.keyDisplay}>
              <label>{t('apiKeys.yourKey')}</label>
              <div className={styles.keyRow}>
                <code className={styles.keyValue}>{createdKey.api_key}</code>
                <button className="btn btn-primary" onClick={handleCopy} style={{ flexShrink: 0 }}>
                  {copied ? t('apiKeys.copied') : t('apiKeys.copy')}
                </button>
              </div>
            </div>

            <div className={styles.keyMeta}>
              <div><strong>{t('apiKeys.table.name')}:</strong> {createdKey.name}</div>
              <div><strong>{t('apiKeys.table.prefix')}:</strong> <code>{createdKey.key_prefix}...</code></div>
              <div><strong>{t('apiKeys.table.scopes')}:</strong> {createdKey.scopes.join(', ')}</div>
              {createdKey.expires_at && (
                <div><strong>{t('apiKeys.expires')}:</strong> {new Date(createdKey.expires_at).toLocaleDateString()}</div>
              )}
            </div>

            <div className={styles.formActions}>
              <button className="btn btn-primary" onClick={() => navigate('/api-keys')}>
                {t('apiKeys.done')}
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/api-keys" className={styles.backLink}>&larr; {t('common.cancel')}</Link>
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
        <div className={styles.formCard}>
          <h2>{t('apiKeys.createTitle')}</h2>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">{t('apiKeys.form.name')} *</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('apiKeys.form.namePlaceholder')}
                required
              />
            </div>

            <div className="form-group">
              <label>{t('apiKeys.form.scopes')} *</label>
              <div className={styles.checkboxList}>
                {AVAILABLE_SCOPES.map((scope) => (
                  <label key={scope.value} className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope.value)}
                      onChange={() => handleScopeToggle(scope.value)}
                    />
                    <span>{scope.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="expiresIn">{t('apiKeys.form.expiry')}</label>
              <select
                id="expiresIn"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className={styles.select}
              >
                <option value="">{t('apiKeys.form.noExpiry')}</option>
                <option value="30">30 {t('apiKeys.form.days')}</option>
                <option value="90">90 {t('apiKeys.form.days')}</option>
                <option value="180">180 {t('apiKeys.form.days')}</option>
                <option value="365">365 {t('apiKeys.form.days')}</option>
              </select>
            </div>

            <div className={styles.formActions}>
              <Link to="/api-keys" className={`btn ${styles.btnCancel}`}>
                {t('common.cancel')}
              </Link>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? t('binForm.saving') : t('apiKeys.generate')}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
