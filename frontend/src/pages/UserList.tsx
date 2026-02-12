import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUsers, deleteUser, type User } from '../api/client'
import styles from './UserList.module.css'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

export default function UserList() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [users, roleFilter, statusFilter])

  async function loadUsers() {
    try {
      setLoading(true)
      setError(null)
      const data = await getUsers()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let filtered = users

    if (roleFilter !== 'all') {
      filtered = filtered.filter((u) => u.role === roleFilter)
    }

    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active'
      filtered = filtered.filter((u) => u.is_active === isActive)
    }

    setFilteredUsers(filtered)
  }

  async function handleDelete(email: string) {
    if (deleteConfirm !== email) {
      setDeleteConfirm(email)
      return
    }

    try {
      await deleteUser(email)
      setDeleteConfirm(null)
      loadUsers()
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

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
        <button onClick={loadUsers} className={styles.retryButton}>
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>{t('users.title')}</h1>
        <Link to="/users/new" className={styles.createButton}>
          + {t('users.createUser')}
        </Link>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>{t('users.filterByRole')}</label>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">{t('users.allRoles')}</option>
            <option value="admin">{t('users.roles.admin')}</option>
            <option value="operator">{t('users.roles.operator')}</option>
            <option value="viewer">{t('users.roles.viewer')}</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>{t('users.filterByStatus')}</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">{t('users.allStatuses')}</option>
            <option value="active">{t('users.status.active')}</option>
            <option value="inactive">{t('users.status.inactive')}</option>
          </select>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('users.noUsersFound')}</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('users.table.name')}</th>
                <th>{t('users.table.email')}</th>
                <th>{t('users.table.role')}</th>
                <th>{t('users.table.status')}</th>
                <th>{t('users.table.lastLogin')}</th>
                <th>{t('users.table.created')}</th>
                <th>{t('users.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isCurrentUser = user.email === currentUser?.email
                return (
                  <tr key={user.email}>
                    <td>
                      {user.name}
                      {isCurrentUser && <span className={styles.youBadge}>{t('users.you')}</span>}
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`${styles.badge} ${getRoleBadgeClass(user.role)}`}>
                        {t(`users.roles.${user.role}`)}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${getStatusBadgeClass(user.is_active)}`}>
                        {user.is_active ? t('users.status.active') : t('users.status.inactive')}
                      </span>
                    </td>
                    <td>{formatDate(user.last_login)}</td>
                    <td>{formatDate(user.created_at)}</td>
                    <td className={styles.actions}>
                      <Link to={`/users/${encodeURIComponent(user.email)}`} className={styles.viewButton}>
                        {t('common.view')}
                      </Link>
                      <Link to={`/users/${encodeURIComponent(user.email)}/edit`} className={styles.editButton}>
                        {t('common.edit')}
                      </Link>
                      {!isCurrentUser && (
                        <button
                          onClick={() => handleDelete(user.email)}
                          className={deleteConfirm === user.email ? styles.confirmDelete : styles.deleteButton}
                        >
                          {deleteConfirm === user.email ? t('common.confirmDelete') : t('common.delete')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
