import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
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
  const sectionIndex = useMemo(() => new Map(sections.map((section) => [section.id, section.label])), [])

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Build mailto link with form data
    const subject = encodeURIComponent(
      `EcoScan Inquiry${formState.company ? ` from ${formState.company}` : ''}`,
    )
    const body = encodeURIComponent(
      `Name: ${formState.name}\nEmail: ${formState.email}\nOrganization: ${formState.company || 'Not specified'}\n\nMessage:\n${formState.message || 'No message provided'}\n\n---\nSent from EcoScan landing page`,
    )
    const mailtoLink = `mailto:partnerships@ecoscan.ai?subject=${subject}&body=${body}`

    // Open email client
    window.location.href = mailtoLink

    setSubmitted(true)
    trackEvent('contact_submit', {
      form_location: 'landing_contact',
    })
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
            <p className="landing-eyebrow">Smart waste operations at city scale</p>
            <h1>Know what&apos;s happening with every bin, in real time.</h1>
            <p className="landing-subtitle">
              EcoScan gives municipalities a unified dashboard for waste bin management. Track fill
              levels, plan efficient routes, and empower citizens to report issues - all from one
              platform built for scale.
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
                Request a demo
              </button>
            </div>
            <div className="landing-metrics">
              <div>
                <strong>Map view</strong>
                <span>See all bins color-coded by status</span>
              </div>
              <div>
                <strong>QR reports</strong>
                <span>Citizens report issues instantly</span>
              </div>
              <div>
                <strong>IoT-ready</strong>
                <span>Architecture built for sensor integration</span>
              </div>
            </div>
          </div>
          <div className="landing-hero-card">
            <h2>What you get today</h2>
            <ul>
              <li>Interactive map dashboard with color-coded bin statuses.</li>
              <li>QR code labels for citizen-powered fill level reporting.</li>
              <li>Route planning with Google Maps integration.</li>
              <li>Multi-language support (EN, CS, DE) for diverse teams.</li>
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
          <h2>How EcoScan works</h2>
          <p>
            A simple, scalable system that combines citizen engagement with operational visibility -
            with a clear path to full IoT automation.
          </p>
        </div>
        <div className="landing-solution-grid">
          <div className="landing-solution">
            <span>01</span>
            <h3>Deploy QR labels</h3>
            <p>
              Print weather-resistant QR codes for each bin. Citizens scan to report fill levels in
              seconds - no app download required.
            </p>
          </div>
          <div className="landing-solution">
            <span>02</span>
            <h3>Monitor from one dashboard</h3>
            <p>
              See all bins on an interactive map. Green, yellow, red indicators show status at a
              glance. Filter, search, and plan routes instantly.
            </p>
          </div>
          <div className="landing-solution">
            <span>03</span>
            <h3>Scale with IoT sensors</h3>
            <p>
              When ready, add ultrasonic sensors for automatic readings. Same dashboard, same API -
              just automated data instead of manual reports.
            </p>
          </div>
        </div>
      </section>

      <section id="opportunities" className="landing-section" data-section="opportunities">
        <div className="landing-section-header">
          <h2>Built to grow with your needs</h2>
          <p>
            Start with basic bin tracking and expand capabilities as your program matures.
          </p>
        </div>
        <div className="landing-grid">
          <div className="landing-card">
            <h3>Multiple bin types</h3>
            <p>
              Track mixed waste, plastic, paper, and glass separately. Color-coded badges make
              sorting visible at a glance.
            </p>
          </div>
          <div className="landing-card">
            <h3>Citizen engagement</h3>
            <p>
              QR codes turn every resident into a sensor. Build community involvement while
              gathering real operational data.
            </p>
          </div>
          <div className="landing-card">
            <h3>Future-ready architecture</h3>
            <p>
              Event-driven backend handles IoT sensors, third-party integrations, and analytics
              modules without rewrites.
            </p>
          </div>
        </div>
      </section>

      <section id="advantages" className="landing-section" data-section="advantages">
        <div className="landing-section-header">
          <h2>Built for scale, flexibility, and partnership</h2>
          <p>
            Our architecture delivers enterprise reliability while keeping operating costs low and
            integrations fast.
          </p>
        </div>
        <div className="landing-advantages">
          <div className="landing-advantage">
            <h3>Scalable by design</h3>
            <p>Serverless workflows scale automatically from a single district to a nationwide rollout.</p>
          </div>
          <div className="landing-advantage">
            <h3>Flexible integrations</h3>
            <p>Open APIs make it easy to onboard new vendors, hardware partners, and analytics tools.</p>
          </div>
          <div className="landing-advantage">
            <h3>Maintainable & secure</h3>
            <p>Infrastructure-as-code, automated tests, and JWT-based access control reduce risk.</p>
          </div>
          <div className="landing-advantage">
            <h3>Data you can trust</h3>
            <p>Audit-ready telemetry, role-based dashboards, and service-level reporting in one place.</p>
          </div>
        </div>
        <div className="landing-architecture">
          <h3>Modern AWS architecture</h3>
          <ul>
            <li>Event-driven ingestion via API Gateway, SQS, and AWS Lambda.</li>
            <li>Real-time dashboards backed by DynamoDB and global CDN delivery.</li>
            <li>Terraform-managed infrastructure for rapid expansion and governance.</li>
          </ul>
        </div>
      </section>

      <section id="roadmap" className="landing-section" data-section="roadmap">
        <div className="landing-section-header">
          <h2>Platform evolution</h2>
          <p>A phased approach from manual reporting to fully automated operations.</p>
        </div>
        <div className="landing-roadmap">
          <div>
            <h3>Available now</h3>
            <ul>
              <li>Admin dashboard with interactive map view.</li>
              <li>QR-based citizen reporting system.</li>
              <li>Route planning with Google Maps.</li>
              <li>Multi-language interface (EN, CS, DE).</li>
            </ul>
          </div>
          <div>
            <h3>Coming soon</h3>
            <ul>
              <li>IoT sensor integration (ultrasonic fill detection).</li>
              <li>Automated threshold alerts via email/SMS.</li>
              <li>Historical analytics and trend reporting.</li>
              <li>Mobile app for field crews.</li>
            </ul>
          </div>
          <div>
            <h3>On the horizon</h3>
            <ul>
              <li>Predictive fill-level forecasting.</li>
              <li>Dynamic route optimization.</li>
              <li>Third-party fleet management integrations.</li>
              <li>Public transparency dashboards.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="contact" className="landing-section" data-section="contact">
        <div className="landing-section-header">
          <h2>Let&apos;s talk</h2>
          <p>
            Tell us about your operations and we&apos;ll prepare a tailored deployment plan.
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
              <label htmlFor="message">What should we know?</label>
              <textarea
                id="message"
                name="message"
                rows={4}
                value={formState.message}
                onChange={handleChange}
              />
            </div>
            <button className="btn btn-primary" type="submit">
              Send contact request
            </button>
            {submitted && (
              <p className="landing-form-success">
                Your email client should open with a pre-filled message. If it didn&apos;t, please
                email us directly at{' '}
                <a href="mailto:partnerships@ecoscan.ai">partnerships@ecoscan.ai</a>
              </p>
            )}
          </form>

          <aside className="landing-contact-info">
            <h3>Why work with us?</h3>
            <ul>
              <li>Production-ready platform you can deploy today</li>
              <li>Enterprise-grade AWS infrastructure</li>
              <li>Clear upgrade path to IoT automation</li>
              <li>Open architecture, no vendor lock-in</li>
            </ul>
            <div className="landing-contact-highlight">
              <p>Quick response guaranteed</p>
              <p>
                Our team typically responds within 24 hours. We&apos;ll schedule a discovery call to
                understand your operations and prepare a tailored proposal.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <strong>EcoScan</strong>
          <p>Intelligent waste operations for modern cities.</p>
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
    </div>
  )
}

export default Landing
