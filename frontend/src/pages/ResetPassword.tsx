import { useState, FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { resetPassword } from '../api/client'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Footer from '../components/Footer'
import styles from './Login.module.css'

export default function ResetPassword() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const rawToken = searchParams.get('token') || ''
  const rawEmail = searchParams.get('email') || ''

  // Validate token format (64 hex chars) and email format
  const hexRegex = /^[0-9a-f]{64}$/i
  const token = hexRegex.test(rawToken) ? rawToken : ''
  const email = rawEmail.includes('@') ? rawEmail : ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!token || !email) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logo}>
            <h1>{t('common.appName')}</h1>
            <p>{t('resetPassword.title')}</p>
          </div>
          <p style={{ color: '#d32f2f', textAlign: 'center' }}>
            {t('resetPassword.invalidLink')}
          </p>
          <Link to="/login" className={styles.forgotPasswordLink} style={{ display: 'block', textAlign: 'center', marginTop: '16px' }}>
            {t('forgotPassword.backToLogin')}
          </Link>
        </div>
        <Footer variant="light" />
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError(t('resetPassword.minLength'))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t('resetPassword.passwordsMismatch'))
      return
    }

    setLoading(true)
    try {
      await resetPassword(email, token, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('resetPassword.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.languageSwitcher}>
        <div className="language-switcher-light">
          <LanguageSwitcher />
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.logo}>
          <h1>{t('common.appName')}</h1>
          <p>{t('resetPassword.title')}</p>
        </div>

        {success ? (
          <div>
            <p style={{ color: '#2e7d32', marginBottom: '20px', textAlign: 'center' }}>
              {t('resetPassword.successMessage')}
            </p>
            <Link to="/login" className={styles.forgotPasswordLink} style={{ display: 'block', textAlign: 'center' }}>
              {t('resetPassword.signIn')}
            </Link>
          </div>
        ) : (
          <>
            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="newPassword">{t('resetPassword.newPassword')}</label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('resetPassword.newPasswordPlaceholder')}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">{t('resetPassword.confirmPassword')}</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? (
                  <>
                    <span className={styles.btnSpinner}></span>
                    {t('resetPassword.resetting')}
                  </>
                ) : (
                  t('resetPassword.resetPassword')
                )}
              </button>
            </form>
          </>
        )}
      </div>
      <Footer variant="light" />
    </div>
  )
}
