import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './CookieConsent.module.css'

// Extend Window interface for dataLayer
declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

const CONSENT_KEY = 'ecoscan_cookie_consent'
const GA_ID = 'G-DJWRTKQQD1'

type ConsentValue = 'accepted' | 'declined' | null

function loadGoogleAnalytics() {
  // Don't load if already loaded
  if (document.querySelector(`script[src*="googletagmanager.com/gtag"]`)) {
    return
  }

  // Load gtag.js script
  const script = document.createElement('script')
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  script.async = true
  document.head.appendChild(script)

  // Initialize gtag
  window.dataLayer = window.dataLayer || []
  const dataLayer = window.dataLayer
  function gtag(...args: unknown[]) {
    dataLayer.push(args)
  }
  gtag('js', new Date())
  gtag('config', GA_ID, { anonymize_ip: true })

  // Make gtag available globally
  window.gtag = gtag
}

export default function CookieConsent() {
  const { t } = useTranslation()
  const [consent, setConsent] = useState<ConsentValue>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY) as ConsentValue
    setConsent(stored)

    if (stored === 'accepted') {
      loadGoogleAnalytics()
    } else if (stored === null) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => setVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setConsent('accepted')
    setVisible(false)
    loadGoogleAnalytics()
  }

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined')
    setConsent('declined')
    setVisible(false)
  }

  // Don't render if consent already given
  if (consent !== null || !visible) {
    return null
  }

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <p className={styles.text}>
          {t('cookies.message', 'We use cookies to analyze site traffic and improve your experience. No personal data is shared with third parties.')}
        </p>
        <div className={styles.buttons}>
          <button onClick={handleDecline} className={styles.declineBtn}>
            {t('cookies.decline', 'Decline')}
          </button>
          <button onClick={handleAccept} className={styles.acceptBtn}>
            {t('cookies.accept', 'Accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
