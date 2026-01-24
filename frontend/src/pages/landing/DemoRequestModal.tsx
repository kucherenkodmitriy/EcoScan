import { useState, useEffect } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import './DemoRequestModal.css'

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

interface DemoRequestModalProps {
  isOpen: boolean
  onClose: () => void
}

function DemoRequestModal({ isOpen, onClose }: DemoRequestModalProps) {
  const { t } = useTranslation()
  const [formState, setFormState] = useState({
    companyName: '',
    email: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // reCAPTCHA site key - replace with your actual key
  const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'

  useEffect(() => {
    // Load reCAPTCHA script
    if (!document.getElementById('recaptcha-script')) {
      const script = document.createElement('script')
      script.id = 'recaptcha-script'
      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`
      document.head.appendChild(script)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setFormState({ companyName: '', email: '' })
      setSubmitted(false)
      setError(null)
    }
  }, [isOpen])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      let token = 'no-recaptcha-token'

      // Get reCAPTCHA token for spam protection
      if (window.grecaptcha) {
        try {
          await window.grecaptcha.ready(() => {})
          token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'demo_request' })
        } catch (recaptchaError) {
          console.warn('reCAPTCHA failed, continuing without it:', recaptchaError)
        }
      } else {
        console.warn('reCAPTCHA not loaded yet, continuing without it')
      }

      // Use /api/contact - handled by Vite proxy (dev) or CloudFront (prod)
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formState.companyName,
          email: formState.email,
          recaptchaToken: token,
          requestType: 'demo',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit demo request')
      }

      setSubmitted(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(`${errorMessage}. ${t('demoModal.errorFallback')}`)
      console.error('Demo request error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          ×
        </button>

        {!submitted ? (
          <>
            <h2>{t('demoModal.title')}</h2>
            <p className="modal-description">{t('demoModal.description')}</p>

            <form onSubmit={handleSubmit} className="demo-form">
              <div className="form-group">
                <label htmlFor="companyName">
                  {t('demoModal.companyName')} <span className="required">{t('demoModal.required')}</span>
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  value={formState.companyName}
                  onChange={handleChange}
                  placeholder={t('demoModal.companyPlaceholder')}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">
                  {t('demoModal.email')} <span className="required">{t('demoModal.required')}</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formState.email}
                  onChange={handleChange}
                  placeholder={t('demoModal.emailPlaceholder')}
                  required
                />
              </div>

              <div className="privacy-notice">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                </svg>
                <span>{t('demoModal.privacyNotice')}</span>
              </div>

              {error && <div className="form-error">{error}</div>}

              <div className="recaptcha-notice">
                {t('demoModal.recaptchaNotice')}{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                  {t('demoModal.privacyPolicy')}
                </a>{' '}
                {t('demoModal.and')}{' '}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
                  {t('demoModal.termsOfService')}
                </a>{' '}
                {t('demoModal.apply')}
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={isSubmitting}>
                {isSubmitting ? t('demoModal.submitting') : t('demoModal.submit')}
              </button>
            </form>
          </>
        ) : (
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>{t('demoModal.successTitle')}</h2>
            <p>
              {t('demoModal.successMessage')} <strong>{formState.email}</strong>.
            </p>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              {t('demoModal.successNote')}{' '}
              <a href="mailto:partnerships@ecoscan.city">partnerships@ecoscan.city</a>
            </p>
            <button className="btn btn-secondary" onClick={onClose}>
              {t('demoModal.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default DemoRequestModal
