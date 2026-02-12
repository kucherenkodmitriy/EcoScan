import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getUser, createUser, updateUser, type CreateUserRequest, type UpdateUserRequest } from '../api/client'
import styles from './UserForm.module.css'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

export default function UserForm() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const { email } = useParams<{ email: string }>()
  const isEdit = Boolean(email)

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'viewer' as 'admin' | 'operator' | 'viewer',
    is_active: true,
  })
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [initialPassword, setInitialPassword] = useState('')

  useEffect(() => {
    if (isEdit && email) {
      loadUser(decodeURIComponent(email))
    }
  }, [email, isEdit])

  async function loadUser(userEmail: string) {
    try {
      setLoading(true)
      setError(null)
      const user = await getUser(userEmail)
      setFormData({
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      setSubmitting(true)
      setError(null)

      if (isEdit && email) {
        const updateRequest: UpdateUserRequest = {
          name: formData.name,
          role: formData.role,
          is_active: formData.is_active,
        }
        await updateUser(decodeURIComponent(email), updateRequest)
        navigate('/settings/users')
      } else {
        const createRequest: CreateUserRequest = {
          email: formData.email,
          name: formData.name,
          role: formData.role,
        }
        const response = await createUser(createRequest)
        setInitialPassword(response.initial_password)
        setShowPasswordModal(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCopyPassword() {
    navigator.clipboard.writeText(initialPassword)
    alert(t('users.passwordCopied'))
  }

  function handlePasswordModalClose() {
    setShowPasswordModal(false)
    navigate('/settings/users')
  }

  const isEditingSelf = isEdit && email && decodeURIComponent(email) === currentUser?.email

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>{isEdit ? t('users.editUser') : t('users.createUser')}</h1>
        <button onClick={() => navigate('/settings/users')} className={styles.backButton}>
          ← {t('common.back')}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="email">{t('users.form.email')}</label>
          <input
            id="email"
            type="email"
            required
            disabled={isEdit}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="user@example.com"
          />
          {isEdit && <p className={styles.fieldHint}>{t('users.form.emailNotEditable')}</p>}
        </div>

        <div className={styles.field}>
          <label htmlFor="name">{t('users.form.name')}</label>
          <input
            id="name"
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="John Doe"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="role">{t('users.form.role')}</label>
          <select
            id="role"
            required
            disabled={isEditingSelf}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
          >
            <option value="admin">{t('users.roles.admin')}</option>
            <option value="operator">{t('users.roles.operator')}</option>
            <option value="viewer">{t('users.roles.viewer')}</option>
          </select>
          {isEditingSelf && <p className={styles.fieldHint}>{t('users.form.cannotChangeOwnRole')}</p>}
        </div>

        {isEdit && (
          <div className={styles.field}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              {t('users.form.active')}
            </label>
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" onClick={() => navigate('/settings/users')} className={styles.cancelButton}>
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={submitting} className={styles.submitButton}>
            {submitting ? t('common.saving') : isEdit ? t('common.save') : t('users.create')}
          </button>
        </div>
      </form>

      {showPasswordModal && (
        <div className={styles.modalOverlay} onClick={handlePasswordModalClose}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>{t('users.userCreatedSuccess')}</h2>
            <p>{t('users.initialPasswordInfo')}</p>
            <div className={styles.passwordBox}>
              <code>{initialPassword}</code>
              <button onClick={handleCopyPassword} className={styles.copyButton}>
                📋 {t('users.copyPassword')}
              </button>
            </div>
            <p className={styles.warningText}>{t('users.passwordWarning')}</p>
            <button onClick={handlePasswordModalClose} className={styles.closeModalButton}>
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
