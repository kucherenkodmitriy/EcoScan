import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import DemoRequestModal from './DemoRequestModal'
import LanguageSelector from '../../components/LanguageSelector'
import './Landing.css'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function trackEvent(action: string, details?: Record<string, unknown>) {
  if (!window.gtag) {
    return
  }

  window.gtag('event', action, {
    event_category: 'landing',
    ...details,
  })
}

function Landing() {
  const { t, i18n } = useTranslation()

  const sections = useMemo(
    () => [
      { id: 'problem', label: t('landing.nav.problem') },
      { id: 'solution', label: t('landing.nav.solution') },
      { id: 'opportunities', label: t('landing.nav.capabilities') },
      { id: 'advantages', label: t('landing.nav.whyEcoScan') },
      { id: 'roadmap', label: t('landing.nav.roadmap') },
      { id: 'contact', label: t('landing.nav.contact') },
    ],
    [t]
  )

  const [formState, setFormState] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)
  const sectionIndex = useMemo(() => new Map(sections.map((section) => [section.id, section.label])), [sections])

  // reCAPTCHA site key
  const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'

  // Check URL for lang parameter on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const langParam = urlParams.get('lang')
    if (langParam && ['en', 'cs', 'de'].includes(langParam)) {
      i18n.changeLanguage(langParam)
    }
  }, [i18n])

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
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement
          if (entry.isIntersecting) {
            const sectionId = target.dataset.section
            if (sectionId) {
              trackEvent('section_view', {
                section_id: sectionId,
                section_label: sectionIndex.get(sectionId),
              })
            }
          }
        })
      },
      { threshold: 0.4 }
    )

    document.querySelectorAll('[data-section]').forEach((section) => observer.observe(section))

    return () => observer.disconnect()
  }, [sectionIndex])

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      let token = 'no-recaptcha-token'

      // Get reCAPTCHA token for spam protection
      if (window.grecaptcha) {
        try {
          await window.grecaptcha.ready(() => {})
          token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'contact_form' })
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
          name: formState.name,
          email: formState.email,
          organization: formState.company,
          message: formState.message,
          recaptchaToken: token,
          requestType: 'contact',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit contact form')
      }

      setSubmitted(true)
      trackEvent('contact_submit', {
        form_location: 'landing_contact',
      })
    } catch (error) {
      console.error('Contact form error:', error)
      // Fallback to mailto if API fails
      const subject = encodeURIComponent(
        `EcoScan Inquiry${formState.company ? ` from ${formState.company}` : ''}`
      )
      const body = encodeURIComponent(
        `Name: ${formState.name}\nEmail: ${formState.email}\nOrganization: ${formState.company || 'Not specified'}\n\nMessage:\n${formState.message || 'No message provided'}\n\n---\nSent from EcoScan landing page (API submission failed)`
      )
      window.location.href = `mailto:partnerships@ecoscan.city?subject=${subject}&body=${body}`
      setSubmitted(true)
    }
  }

  return (
    <div className="landing">
      <header className="landing-hero">
        <nav className="landing-nav">
          <div className="landing-logo">EcoScan</div>
          <div className="landing-nav-links">
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.label}
              </a>
            ))}
          </div>
          <div className="landing-nav-actions">
            <LanguageSelector variant="landing" />
          </div>
        </nav>

        <div className="landing-hero-content">
          <div>
            <p className="landing-eyebrow">{t('landing.hero.eyebrow')}</p>
            <h1>{t('landing.hero.title')}</h1>
            <p className="landing-subtitle">{t('landing.hero.subtitle')}</p>
            <div className="landing-hero-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  trackEvent('cta_click', { label: 'hero_primary' })
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                {t('landing.hero.cta')}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  trackEvent('cta_click', { label: 'hero_demo' })
                  setIsDemoModalOpen(true)
                }}
              >
                {t('landing.hero.ctaDemo')}
              </button>
            </div>
            <div className="landing-metrics">
              <div>
                <strong>{t('landing.hero.metric1Title')}</strong>
                <span>{t('landing.hero.metric1Desc')}</span>
              </div>
              <div>
                <strong>{t('landing.hero.metric2Title')}</strong>
                <span>{t('landing.hero.metric2Desc')}</span>
              </div>
              <div>
                <strong>{t('landing.hero.metric3Title')}</strong>
                <span>{t('landing.hero.metric3Desc')}</span>
              </div>
            </div>
          </div>
          <div className="landing-hero-card">
            <h2>{t('landing.heroCard.title')}</h2>
            <ul>
              <li>{t('landing.heroCard.item1')}</li>
              <li>{t('landing.heroCard.item2')}</li>
              <li>{t('landing.heroCard.item3')}</li>
              <li>{t('landing.heroCard.item4')}</li>
            </ul>
          </div>
        </div>
      </header>

      <section id="problem" className="landing-section" data-section="problem">
        <div className="landing-section-header">
          <h2>{t('landing.problem.title')}</h2>
          <p>{t('landing.problem.subtitle')}</p>
        </div>
        <div className="landing-grid">
          <div className="landing-card">
            <h3>{t('landing.problem.card1Title')}</h3>
            <p>{t('landing.problem.card1Desc')}</p>
          </div>
          <div className="landing-card">
            <h3>{t('landing.problem.card2Title')}</h3>
            <p>{t('landing.problem.card2Desc')}</p>
          </div>
          <div className="landing-card">
            <h3>{t('landing.problem.card3Title')}</h3>
            <p>{t('landing.problem.card3Desc')}</p>
          </div>
        </div>
      </section>

      <section id="solution" className="landing-section" data-section="solution">
        <div className="landing-section-header">
          <h2>{t('landing.solution.title')}</h2>
          <p>{t('landing.solution.subtitle')}</p>
        </div>
        <div className="landing-solution-grid">
          <div className="landing-solution">
            <span>{t('landing.solution.step1Num')}</span>
            <h3>{t('landing.solution.step1Title')}</h3>
            <p>{t('landing.solution.step1Desc')}</p>
          </div>
          <div className="landing-solution">
            <span>{t('landing.solution.step2Num')}</span>
            <h3>{t('landing.solution.step2Title')}</h3>
            <p>{t('landing.solution.step2Desc')}</p>
          </div>
          <div className="landing-solution">
            <span>{t('landing.solution.step3Num')}</span>
            <h3>{t('landing.solution.step3Title')}</h3>
            <p>{t('landing.solution.step3Desc')}</p>
          </div>
        </div>
      </section>

      <section id="opportunities" className="landing-section" data-section="opportunities">
        <div className="landing-section-header">
          <h2>{t('landing.capabilities.title')}</h2>
          <p>{t('landing.capabilities.subtitle')}</p>
        </div>
        <div className="landing-grid">
          <div className="landing-card">
            <h3>{t('landing.capabilities.card1Title')}</h3>
            <p>{t('landing.capabilities.card1Desc')}</p>
          </div>
          <div className="landing-card">
            <h3>{t('landing.capabilities.card2Title')}</h3>
            <p>{t('landing.capabilities.card2Desc')}</p>
          </div>
          <div className="landing-card">
            <h3>{t('landing.capabilities.card3Title')}</h3>
            <p>{t('landing.capabilities.card3Desc')}</p>
          </div>
        </div>
      </section>

      <section id="advantages" className="landing-section" data-section="advantages">
        <div className="landing-section-header">
          <h2>{t('landing.advantages.title')}</h2>
          <p>{t('landing.advantages.subtitle')}</p>
        </div>
        <div className="landing-advantages">
          <div className="landing-advantage">
            <h3>{t('landing.advantages.adv1Title')}</h3>
            <p>{t('landing.advantages.adv1Desc')}</p>
          </div>
          <div className="landing-advantage">
            <h3>{t('landing.advantages.adv2Title')}</h3>
            <p>{t('landing.advantages.adv2Desc')}</p>
          </div>
          <div className="landing-advantage">
            <h3>{t('landing.advantages.adv3Title')}</h3>
            <p>{t('landing.advantages.adv3Desc')}</p>
          </div>
          <div className="landing-advantage">
            <h3>{t('landing.advantages.adv4Title')}</h3>
            <p>{t('landing.advantages.adv4Desc')}</p>
          </div>
        </div>
        <div className="landing-architecture">
          <h3>{t('landing.advantages.archTitle')}</h3>
          <ul>
            <li>{t('landing.advantages.archItem1')}</li>
            <li>{t('landing.advantages.archItem2')}</li>
            <li>{t('landing.advantages.archItem3')}</li>
          </ul>
        </div>
      </section>

      <section id="roadmap" className="landing-section" data-section="roadmap">
        <div className="landing-section-header">
          <h2>{t('landing.roadmap.title')}</h2>
          <p>{t('landing.roadmap.subtitle')}</p>
        </div>
        <div className="landing-roadmap">
          <div>
            <h3>{t('landing.roadmap.phase1Title')}</h3>
            <ul>
              <li>{t('landing.roadmap.phase1Item1')}</li>
              <li>{t('landing.roadmap.phase1Item2')}</li>
              <li>{t('landing.roadmap.phase1Item3')}</li>
              <li>{t('landing.roadmap.phase1Item4')}</li>
            </ul>
          </div>
          <div>
            <h3>{t('landing.roadmap.phase2Title')}</h3>
            <ul>
              <li>{t('landing.roadmap.phase2Item1')}</li>
              <li>{t('landing.roadmap.phase2Item2')}</li>
              <li>{t('landing.roadmap.phase2Item3')}</li>
              <li>{t('landing.roadmap.phase2Item4')}</li>
            </ul>
          </div>
          <div>
            <h3>{t('landing.roadmap.phase3Title')}</h3>
            <ul>
              <li>{t('landing.roadmap.phase3Item1')}</li>
              <li>{t('landing.roadmap.phase3Item2')}</li>
              <li>{t('landing.roadmap.phase3Item3')}</li>
              <li>{t('landing.roadmap.phase3Item4')}</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="contact" className="landing-section" data-section="contact">
        <div className="landing-section-header">
          <h2>{t('landing.contact.title')}</h2>
          <p>{t('landing.contact.subtitle')}</p>
        </div>
        <div className="landing-contact">
          <form className="landing-form" onSubmit={handleSubmit}>
            <div className="landing-form-row">
              <div>
                <label htmlFor="name">{t('landing.contact.formName')}</label>
                <input id="name" name="name" value={formState.name} onChange={handleChange} required />
              </div>
              <div>
                <label htmlFor="email">{t('landing.contact.formEmail')}</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formState.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="company">{t('landing.contact.formOrganization')}</label>
              <input id="company" name="company" value={formState.company} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="message">{t('landing.contact.formMessage')}</label>
              <textarea
                id="message"
                name="message"
                rows={4}
                value={formState.message}
                onChange={handleChange}
              />
            </div>
            <p className="landing-form-notice">{t('landing.contact.formNotice')}</p>
            <button className="btn btn-primary" type="submit">
              {t('landing.contact.formSubmit')}
            </button>
            {submitted && (
              <p className="landing-form-success">
                {t('landing.contact.formSuccess')}{' '}
                <a href="mailto:partnerships@ecoscan.city">partnerships@ecoscan.city</a>
              </p>
            )}
            <p className="landing-form-recaptcha">
              {t('landing.contact.recaptchaNotice')}{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                {t('landing.contact.recaptchaPrivacy')}
              </a>{' '}
              {t('landing.contact.recaptchaAnd')}{' '}
              <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
                {t('landing.contact.recaptchaTerms')}
              </a>{' '}
              {t('landing.contact.recaptchaApply')}
            </p>
          </form>

          <aside className="landing-contact-info">
            <h3>{t('landing.contact.infoTitle')}</h3>
            <ul>
              <li>{t('landing.contact.infoItem1')}</li>
              <li>{t('landing.contact.infoItem2')}</li>
              <li>{t('landing.contact.infoItem3')}</li>
              <li>{t('landing.contact.infoItem4')}</li>
            </ul>
            <div className="landing-contact-highlight">
              <p>{t('landing.contact.highlightTitle')}</p>
              <p>{t('landing.contact.highlightDesc')}</p>
            </div>
          </aside>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <strong>EcoScan</strong>
          <p>{t('landing.footer.tagline')}</p>
        </div>
        <div className="landing-footer-links">
          <a href="/privacy">{t('landing.footer.privacy')}</a>
          <a href="/terms">{t('landing.footer.terms')}</a>
          <a href="mailto:partnerships@ecoscan.city">{t('landing.footer.contact')}</a>
        </div>
        <div className="landing-footer-copy">
          <p>{t('landing.footer.copyright')}</p>
        </div>
      </footer>

      <DemoRequestModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </div>
  )
}

export default Landing
