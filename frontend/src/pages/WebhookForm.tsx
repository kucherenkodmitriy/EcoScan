import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getWebhook, createWebhook, updateWebhook, WebhookInfo, CreateWebhookInput, UpdateWebhookInput } from '../api/client'
import LanguageSwitcher from '../components/LanguageSwitcher'
import styles from './WebhookForm.module.css'

const AUTH_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'api_key', label: 'API Key' },
  { value: 'bearer', label: 'Bearer Token' },
]

const AVAILABLE_EVENTS = ['bin.status.updated']

export default function WebhookForm() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [authType, setAuthType] = useState('none')
  const [authHeader, setAuthHeader] = useState('')
  const [authValue, setAuthValue] = useState('')
  const [events, setEvents] = useState<string[]>(['bin.status.updated'])
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!isEdit || !id) return

    const loadWebhook = async () => {
      try {
        const webhook: WebhookInfo = await getWebhook(id)
        setName(webhook.name || '')
        setUrl(webhook.url || '')
        setAuthType(webhook.auth_type || 'none')
        setAuthHeader(webhook.auth_header || '')
        setEvents(webhook.events || [])
        setIsActive(webhook.is_active)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('webhooks.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }

    loadWebhook()
  }, [id, isEdit, t])

  const handleEventToggle = (event: string) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError(t('webhooks.nameRequired'))
      return
    }

    if (!url.trim()) {
      setError(t('webhooks.urlRequired'))
      return
    }

    setSaving(true)

    try {
      if (isEdit && id) {
        const data: UpdateWebhookInput = {
          name: name.trim(),
          url: url.trim(),
          auth_type: authType,
          auth_header: authType !== 'none' ? authHeader.trim() || undefined : undefined,
          auth_value: authValue.trim() || undefined,
          events,
          is_active: isActive,
        }
        await updateWebhook(id, data)
        navigate(`/webhooks/${id}`)
      } else {
        const data: CreateWebhookInput = {
          name: name.trim(),
          url: url.trim(),
          auth_type: authType,
          auth_header: authType !== 'none' ? authHeader.trim() || undefined : undefined,
          auth_value: authValue.trim() || undefined,
          events,
        }
        const newWebhook = await createWebhook(data)
        navigate(`/webhooks/${newWebhook.webhook_id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('webhooks.failedToSave'))
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to={isEdit ? `/webhooks/${id}` : '/settings/webhooks'} className={styles.backLink}>
            &larr; {t('common.cancel')}
          </Link>
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
        ) : (
          <div className={styles.formCard}>
            <h2>{isEdit ? t('webhooks.editTitle') : t('webhooks.createTitle')}</h2>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">{t('webhooks.form.name')} *</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('webhooks.form.namePlaceholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="url">{t('webhooks.form.url')} *</label>
                <input
                  type="url"
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={t('webhooks.form.urlPlaceholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="authType">{t('webhooks.form.authType')}</label>
                <select
                  id="authType"
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value)}
                  className={styles.select}
                >
                  {AUTH_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {authType === 'api_key' && (
                <div className="form-group">
                  <label htmlFor="authHeader">{t('webhooks.form.authHeader')}</label>
                  <input
                    type="text"
                    id="authHeader"
                    value={authHeader}
                    onChange={(e) => setAuthHeader(e.target.value)}
                    placeholder="X-Api-Key"
                  />
                </div>
              )}

              {authType !== 'none' && (
                <div className="form-group">
                  <label htmlFor="authValue">{t('webhooks.form.authValue')}</label>
                  <input
                    type="password"
                    id="authValue"
                    value={authValue}
                    onChange={(e) => setAuthValue(e.target.value)}
                    placeholder={isEdit ? t('webhooks.form.authValueEditHint') : t('webhooks.form.authValuePlaceholder')}
                  />
                  {isEdit && (
                    <p className={styles.hint}>{t('webhooks.form.authValueEditHint')}</p>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>{t('webhooks.form.events')}</label>
                <div className={styles.checkboxList}>
                  {AVAILABLE_EVENTS.map((event) => (
                    <label key={event} className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={events.includes(event)}
                        onChange={() => handleEventToggle(event)}
                      />
                      <span>{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              {isEdit && (
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <span>{t('binForm.activeLabel')}</span>
                  </label>
                </div>
              )}

              <div className={styles.formActions}>
                <Link
                  to={isEdit ? `/webhooks/${id}` : '/settings/webhooks'}
                  className={`btn ${styles.btnCancel}`}
                >
                  {t('common.cancel')}
                </Link>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('binForm.saving') : isEdit ? t('binForm.saveChanges') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
