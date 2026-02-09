import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { forgotPassword } from '../api/client'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Footer from '../components/Footer'
import styles from './Login.module.css'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError(t('forgotPassword.emailRequired'))
      return
    }

    setLoading(true)
    try {
      await forgotPassword(email)
      setSubmitted(true)
    } catch {
      // Always show success to prevent email enumeration
      setSubmitted(true)
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
          <p>{t('forgotPassword.title')}</p>
        </div>

        {submitted ? (
          <div>
            <p style={{ color: '#2e7d32', marginBottom: '20px', textAlign: 'center' }}>
              {t('forgotPassword.successMessage')}
            </p>
            <Link to="/login" className={styles.forgotPasswordLink} style={{ display: 'block', textAlign: 'center' }}>
              {t('forgotPassword.backToLogin')}
            </Link>
          </div>
        ) : (
          <>
            {error && <div className="error-message">{error}</div>}

            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              {t('forgotPassword.description')}
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">{t('login.email')}</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('login.emailPlaceholder')}
                  autoComplete="email"
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? (
                  <>
                    <span className={styles.btnSpinner}></span>
                    {t('forgotPassword.sending')}
                  </>
                ) : (
                  t('forgotPassword.sendLink')
                )}
              </button>
            </form>

            <Link to="/login" className={styles.forgotPasswordLink} style={{ display: 'block', textAlign: 'center', marginTop: '16px' }}>
              {t('forgotPassword.backToLogin')}
            </Link>
          </>
        )}
      </div>
      <Footer variant="light" />
    </div>
  )
}
