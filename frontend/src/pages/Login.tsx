import { useState, FormEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import Footer from '../components/Footer'
import styles from './Login.module.css'

export default function Login() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, authLoading, navigate])

  // Don't render login form while checking auth state
  if (authLoading || isAuthenticated) {
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError(t('login.errorBothRequired'))
      return
    }

    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.errorFailed'))
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
          <p>{t('login.title')}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

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

          <div className="form-group">
            <label htmlFor="password">{t('login.password')}</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? (
              <>
                <span className={styles.btnSpinner}></span>
                {t('login.signingIn')}
              </>
            ) : (
              t('login.signIn')
            )}
          </button>
        </form>

        <Link to="/forgot-password" className={styles.forgotPasswordLink}>
          {t('login.forgotPassword')}
        </Link>
      </div>
      <Footer variant="light" />
    </div>
  )
}
