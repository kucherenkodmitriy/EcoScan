import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { getUser, deleteUser, type User } from '../api/client'
import styles from './UserDetail.module.css'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

export default function UserDetail() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const { email } = useParams<{ email: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (email) {
      loadUser(decodeURIComponent(email))
    }
  }, [email])

  async function loadUser(userEmail: string) {
    try {
      setLoading(true)
      setError(null)
      const data = await getUser(userEmail)
      setUser(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }

    if (!user) return

    try {
      await deleteUser(user.email)
      navigate('/settings/users')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  function getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'admin':
        return styles.badgeAdmin
      case 'operator':
        return styles.badgeOperator
      default:
        return styles.badgeViewer
    }
  }

  function getStatusBadgeClass(isActive: boolean): string {
    return isActive ? styles.badgeActive : styles.badgeInactive
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return t('users.never')
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>{t('common.loading')}</div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error || 'User not found'}</div>
        <button onClick={() => navigate('/settings/users')} className={styles.backButton}>
          ← {t('common.back')}
        </button>
      </div>
    )
  }

  const isCurrentUser = user.email === currentUser?.email

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>
          {t('users.userDetails')}
          {isCurrentUser && <span className={styles.youBadge}>{t('users.you')}</span>}
        </h1>
        <button onClick={() => navigate('/settings/users')} className={styles.backButton}>
          ← {t('common.back')}
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.section}>
          <h2>{t('users.basicInfo')}</h2>

          <div className={styles.field}>
            <label>{t('users.form.name')}</label>
            <p>{user.name}</p>
          </div>

          <div className={styles.field}>
            <label>{t('users.form.email')}</label>
            <p>{user.email}</p>
          </div>

          <div className={styles.field}>
            <label>{t('users.form.role')}</label>
            <p>
              <span className={`${styles.badge} ${getRoleBadgeClass(user.role)}`}>
                {t(`users.roles.${user.role}`)}
              </span>
            </p>
          </div>

          <div className={styles.field}>
            <label>{t('users.form.status')}</label>
            <p>
              <span className={`${styles.badge} ${getStatusBadgeClass(user.is_active)}`}>
                {user.is_active ? t('users.status.active') : t('users.status.inactive')}
              </span>
            </p>
          </div>
        </div>

        <div className={styles.section}>
          <h2>{t('users.timestamps')}</h2>

          <div className={styles.field}>
            <label>{t('users.table.created')}</label>
            <p>{formatDate(user.created_at)}</p>
          </div>

          <div className={styles.field}>
            <label>{t('users.table.lastLogin')}</label>
            <p>{formatDate(user.last_login)}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <Link to={`/users/${encodeURIComponent(user.email)}/edit`} className={styles.editButton}>
            ✏️ {t('common.edit')}
          </Link>
          {!isCurrentUser && (
            <button
              onClick={handleDelete}
              className={deleteConfirm ? styles.confirmDelete : styles.deleteButton}
            >
              {deleteConfirm ? t('common.confirmDelete') : `🗑️ ${t('common.delete')}`}
            </button>
          )}
          {deleteConfirm && (
            <button onClick={() => setDeleteConfirm(false)} className={styles.cancelButton}>
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
