import { useState, useEffect } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
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
      setError(`Failed to submit: ${errorMessage}. Please try again or email us at partnerships@ecoscan.city`)
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
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          ×
        </button>

        {!submitted ? (
          <>
            <h2>Request a Demo</h2>
            <p className="modal-description">
              See EcoScan in action. We&apos;ll walk you through the platform and discuss how it could fit
              your operational needs.
            </p>

            <form onSubmit={handleSubmit} className="demo-form">
              <div className="form-group">
                <label htmlFor="companyName">
                  Company Name <span className="required">*</span>
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  value={formState.companyName}
                  onChange={handleChange}
                  placeholder="Your organization"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">
                  Email Address <span className="required">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formState.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div className="privacy-notice">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                </svg>
                <span>
                  We never send spam or automated messages. Your information is only used to schedule a
                  personalized demo.
                </span>
              </div>

              {error && <div className="form-error">{error}</div>}

              <div className="recaptcha-notice">
                This site is protected by reCAPTCHA and the Google{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </a>{' '}
                apply.
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Request Demo'}
              </button>
            </form>
          </>
        ) : (
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>Thank you!</h2>
            <p>
              Your demo request has been received. We&apos;ll review it and get back to you within 24 hours at{' '}
              <strong>{formState.email}</strong>.
            </p>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              If you don&apos;t hear from us, please check your spam folder or contact{' '}
              <a href="mailto:partnerships@ecoscan.city">partnerships@ecoscan.city</a>
            </p>
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default DemoRequestModal
