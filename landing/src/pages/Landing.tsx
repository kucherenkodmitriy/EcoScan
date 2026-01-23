import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import DemoRequestModal from '../components/DemoRequestModal'
import './Landing.css'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

const sections = [
  { id: 'problem', label: 'Problem' },
  { id: 'solution', label: 'How it works' },
  { id: 'opportunities', label: 'Capabilities' },
  { id: 'advantages', label: 'Why EcoScan' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'contact', label: 'Contact' },
]

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
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)
  const sectionIndex = useMemo(() => new Map(sections.map((section) => [section.id, section.label])), [])

  // reCAPTCHA site key
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
      { threshold: 0.4 },
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
      // Get reCAPTCHA token for spam protection
      await window.grecaptcha!.ready(() => {})
      const token = await window.grecaptcha!.execute(RECAPTCHA_SITE_KEY, { action: 'contact_form' })

      // Get API endpoint from environment
      const apiGatewayId = import.meta.env.VITE_API_GATEWAY_ID
      const apiEndpoint = apiGatewayId
        ? `https://${apiGatewayId}.execute-api.eu-central-1.amazonaws.com/${import.meta.env.MODE || 'local'}/contact`
        : 'http://localhost:4566/restapis/YOUR_API_ID/local/_user_request_/contact'

      // Send to API Gateway
      const response = await fetch(apiEndpoint, {
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
        `EcoScan Inquiry${formState.company ? ` from ${formState.company}` : ''}`,
      )
      const body = encodeURIComponent(
        `Name: ${formState.name}\nEmail: ${formState.email}\nOrganization: ${formState.company || 'Not specified'}\n\nMessage:\n${formState.message || 'No message provided'}\n\n---\nSent from EcoScan landing page (API submission failed)`,
      )
      window.location.href = `mailto:partnerships@ecoscan.ai?subject=${subject}&body=${body}`
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
            {/* CTAs removed: no admin login or demo request from landing */}
          </div>
        </nav>

        <div className="landing-hero-content">
          <div>
            <p className="landing-eyebrow">Exploring smart waste operations at city scale</p>
            <h1>Demonstrating real-time bin management capabilities</h1>
            <p className="landing-subtitle">
              EcoScan is an MVP platform showcasing how municipalities could manage waste bins with
              modern technology. Track fill levels, plan routes, and enable citizen reporting -
              a foundation for discussing your specific operational needs.
            </p>
            <div className="landing-hero-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  trackEvent('cta_click', { label: 'hero_primary' })
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                Discuss your needs
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  trackEvent('cta_click', { label: 'hero_demo' })
                  setIsDemoModalOpen(true)
                }}
              >
                Request a Demo
              </button>
            </div>
            <div className="landing-metrics">
              <div>
                <strong>Map view</strong>
                <span>Visualize bins with color-coded status</span>
              </div>
              <div>
                <strong>QR reports</strong>
                <span>Citizen reporting concept in action</span>
              </div>
              <div>
                <strong>IoT-ready</strong>
                <span>Architecture designed for sensor data</span>
              </div>
            </div>
          </div>
          <div className="landing-hero-card">
            <h2>What this MVP demonstrates</h2>
            <ul>
              <li>Interactive map dashboard with color-coded bin statuses</li>
              <li>QR code system for citizen-powered reporting</li>
              <li>Route planning concepts with mapping integration</li>
              <li>Multi-language support (EN, CS, DE) for international projects</li>
            </ul>
          </div>
        </div>
      </header>

      <section id="problem" className="landing-section" data-section="problem">
        <div className="landing-section-header">
          <h2>The problem we solve</h2>
          <p>
            Waste operations still rely on fixed routes, manual inspections, and siloed data. The result is
            overflowing bins, costly emergency pickups, and limited accountability across public-private
            partnerships.
          </p>
        </div>
        <div className="landing-grid">
          <div className="landing-card">
            <h3>Overflow & service risk</h3>
            <p>Bins overflow before crews arrive, hurting public satisfaction and city hygiene scores.</p>
          </div>
          <div className="landing-card">
            <h3>Blind spots</h3>
            <p>Leadership lacks a unified view of asset performance, vendor SLAs, and budget impacts.</p>
          </div>
          <div className="landing-card">
            <h3>Static routes</h3>
            <p>Fixed schedules waste fuel, labor, and maintenance capacity when bins are half empty.</p>
          </div>
        </div>
      </section>

      <section id="solution" className="landing-section" data-section="solution">
        <div className="landing-section-header">
          <h2>How this concept works</h2>
          <p>
            A demonstration system combining citizen engagement with operational visibility -
            designed to evolve toward full IoT automation in production deployments.
          </p>
        </div>
        <div className="landing-solution-grid">
          <div className="landing-solution">
            <span>01</span>
            <h3>QR-based reporting</h3>
            <p>
              Generate QR codes for bins that citizens can scan to report fill levels -
              no app download required. A practical starting point for community engagement.
            </p>
          </div>
          <div className="landing-solution">
            <span>02</span>
            <h3>Centralized dashboard view</h3>
            <p>
              View all bins on an interactive map with visual status indicators.
              The MVP demonstrates filtering, search, and basic route planning capabilities.
            </p>
          </div>
          <div className="landing-solution">
            <span>03</span>
            <h3>Path to IoT integration</h3>
            <p>
              The architecture is designed to accept sensor data for automated readings in future implementations.
              Same API structure, ready to scale when you add hardware.
            </p>
          </div>
        </div>
      </section>

      <section id="opportunities" className="landing-section" data-section="opportunities">
        <div className="landing-section-header">
          <h2>Capabilities we're showcasing</h2>
          <p>
            This MVP demonstrates core concepts that could be expanded based on your operational requirements.
          </p>
        </div>
        <div className="landing-grid">
          <div className="landing-card">
            <h3>Multiple waste streams</h3>
            <p>
              The platform supports categorizing bins by waste type (mixed, plastic, paper, glass) with
              color-coded visual differentiation in the interface.
            </p>
          </div>
          <div className="landing-card">
            <h3>Community participation model</h3>
            <p>
              QR code scanning demonstrates how residents could contribute operational data,
              creating a foundation for citizen engagement programs.
            </p>
          </div>
          <div className="landing-card">
            <h3>Extensible architecture</h3>
            <p>
              Built with event-driven patterns that can accommodate IoT sensors, third-party systems,
              and analytics modules in production implementations.
            </p>
          </div>
        </div>
      </section>

      <section id="advantages" className="landing-section" data-section="advantages">
        <div className="landing-section-header">
          <h2>A foundation for scalable solutions</h2>
          <p>
            Our architectural approach demonstrates how modern cloud infrastructure could support
            municipal waste management from pilot to production scale.
          </p>
        </div>
        <div className="landing-advantages">
          <div className="landing-advantage">
            <h3>Designed for scale</h3>
            <p>Serverless architecture showcases how a production system could scale from a single district to regional deployments.</p>
          </div>
          <div className="landing-advantage">
            <h3>Integration-ready</h3>
            <p>API-first design demonstrates how different vendors, hardware types, and analytics tools could connect to a unified platform.</p>
          </div>
          <div className="landing-advantage">
            <h3>Professional practices</h3>
            <p>Infrastructure-as-code, automated testing, and modern authentication patterns showcase enterprise development standards.</p>
          </div>
          <div className="landing-advantage">
            <h3>Transparent operations</h3>
            <p>The architecture supports audit trails, role-based access, and operational reporting patterns for governance requirements.</p>
          </div>
        </div>
        <div className="landing-architecture">
          <h3>Modern cloud architecture</h3>
          <ul>
            <li>Event-driven data flow using API Gateway, SQS, and Lambda functions</li>
            <li>Dashboard backed by DynamoDB with infrastructure managed via Terraform</li>
            <li>Patterns demonstrated for real-time updates and third-party integrations</li>
          </ul>
        </div>
      </section>

      <section id="roadmap" className="landing-section" data-section="roadmap">
        <div className="landing-section-header">
          <h2>From MVP to production</h2>
          <p>A staged development approach - what's demonstrated now and what could be built for production deployments.</p>
        </div>
        <div className="landing-roadmap">
          <div>
            <h3>Current MVP features</h3>
            <ul>
              <li>Admin dashboard with interactive map interface</li>
              <li>QR-based reporting workflow demonstration</li>
              <li>Basic route planning with mapping integration</li>
              <li>Multi-language support (EN, CS, DE) framework</li>
            </ul>
          </div>
          <div>
            <h3>Production considerations</h3>
            <ul>
              <li>IoT sensor integration and hardware partnerships</li>
              <li>Automated alerting systems (email/SMS)</li>
              <li>Historical analytics and reporting capabilities</li>
              <li>Mobile applications for field operations</li>
            </ul>
          </div>
          <div>
            <h3>Future possibilities</h3>
            <ul>
              <li>Predictive modeling based on historical patterns</li>
              <li>Advanced route optimization algorithms</li>
              <li>Fleet management system integrations</li>
              <li>Public-facing transparency dashboards</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="contact" className="landing-section" data-section="contact">
        <div className="landing-section-header">
          <h2>Let&apos;s explore possibilities together</h2>
          <p>
            Share your operational challenges and we can discuss how this platform concept could be
            adapted to your specific requirements.
          </p>
        </div>
        <div className="landing-contact">
          <form className="landing-form" onSubmit={handleSubmit}>
            <div className="landing-form-row">
              <div>
                <label htmlFor="name">Name</label>
                <input id="name" name="name" value={formState.name} onChange={handleChange} required />
              </div>
              <div>
                <label htmlFor="email">Work email</label>
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
              <label htmlFor="company">Organization</label>
              <input id="company" name="company" value={formState.company} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="message">Tell us about your waste management challenges</label>
              <textarea
                id="message"
                name="message"
                rows={4}
                value={formState.message}
                onChange={handleChange}
              />
            </div>
            <p className="landing-form-notice">
              We never send spam or automated messages. Your information is only used for direct communication.
            </p>
            <button className="btn btn-primary" type="submit">
              Start a conversation
            </button>
            {submitted && (
              <p className="landing-form-success">
                Thank you! We&apos;ve received your message and will respond within 24 hours.
                If you don&apos;t hear from us, please check your spam folder or email{' '}
                <a href="mailto:partnerships@ecoscan.ai">partnerships@ecoscan.ai</a>
              </p>
            )}
            <p className="landing-form-recaptcha">
              This site is protected by reCAPTCHA and the Google{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>{' '}
              and{' '}
              <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </a>{' '}
              apply.
            </p>
          </form>

          <aside className="landing-contact-info">
            <h3>What to expect</h3>
            <ul>
              <li>Demo of the current MVP capabilities</li>
              <li>Discussion of your specific operational needs</li>
              <li>Exploration of customization and development paths</li>
              <li>Transparent conversation about timelines and partnerships</li>
            </ul>
            <div className="landing-contact-highlight">
              <p>Partnership-focused approach</p>
              <p>
                We&apos;re looking for forward-thinking organizations to explore how this concept
                could evolve into production solutions. Let&apos;s discuss what&apos;s possible together.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <strong>EcoScan</strong>
          <p>Exploring smart waste operations for modern cities.</p>
        </div>
        <div className="landing-footer-links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="mailto:partnerships@ecoscan.ai">Contact</a>
        </div>
        <div className="landing-footer-copy">
          <p>© 2026 EcoScan. All rights reserved.</p>
        </div>
      </footer>

      <DemoRequestModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </div>
  )
}

export default Landing
