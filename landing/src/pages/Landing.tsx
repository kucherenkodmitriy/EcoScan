import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import './Landing.css'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

const sections = [
  { id: 'problem', label: 'The problem' },
  { id: 'solution', label: 'Solution' },
  { id: 'opportunities', label: 'Expansion' },
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
            <h1>Real-time visibility for every bin, route, and partner.</h1>
            <p className="landing-subtitle">
              EcoScan turns fragmented waste operations into a unified, data-driven platform. We reduce
              overflow incidents, lower collection costs, and help municipalities hit sustainability goals
              with confidence.
            </p>
            <div className="landing-hero-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => trackEvent('cta_click', { label: 'hero_primary' })}
              >
                See the platform in action
              </button>
            </div>
            <div className="landing-metrics">
              <div>
                <strong>35%</strong>
                <span>average reduction in overflow events</span>
              </div>
              <div>
                <strong>22%</strong>
                <span>lower collection miles in pilot routes</span>
              </div>
              <div>
                <strong>24/7</strong>
                <span>visibility across fleets & assets</span>
              </div>
            </div>
          </div>
          <div className="landing-hero-card">
            <h2>Executive snapshot</h2>
            <ul>
              <li>Live asset health, fill-rate predictions, and SLA alerts.</li>
              <li>IoT ingestion at scale with serverless, event-driven backend.</li>
              <li>Automated dashboards for city leadership and partners.</li>
              <li>Rapid onboarding for new districts and private operators.</li>
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
          <h2>EcoScan: the unified waste intelligence platform</h2>
          <p>
            EcoScan connects IoT-enabled bins, operations teams, and executive reporting in one platform so
            every stakeholder sees the same, actionable data.
          </p>
        </div>
        <div className="landing-solution-grid">
          <div className="landing-solution">
            <span>01</span>
            <h3>Live sensing & alerts</h3>
            <p>Receive real-time fill level updates and instant alerts when thresholds are exceeded.</p>
          </div>
          <div className="landing-solution">
            <span>02</span>
            <h3>Operational command center</h3>
            <p>Dashboards consolidate asset health, SLA compliance, and route efficiency.</p>
          </div>
          <div className="landing-solution">
            <span>03</span>
            <h3>Predictive analytics</h3>
            <p>Forecast overflow risk and automate smarter route plans before issues appear.</p>
          </div>
        </div>
      </section>

      <section id="opportunities" className="landing-section" data-section="opportunities">
        <div className="landing-section-header">
          <h2>Additional challenges we can solve</h2>
          <p>
            The same infrastructure unlocks insights for waste, recycling, and city services beyond bins.
          </p>
        </div>
        <div className="landing-grid">
          <div className="landing-card">
            <h3>Illegal dumping detection</h3>
            <p>Correlate fill spikes with location data to flag potential dumping hotspots.</p>
          </div>
          <div className="landing-card">
            <h3>Recycling contamination</h3>
            <p>Track bin usage patterns to guide targeted education and reduce contamination costs.</p>
          </div>
          <div className="landing-card">
            <h3>Public-space maintenance</h3>
            <p>Integrate with street cleaning, lighting, and park services for unified city operations.</p>
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
          <h2>Roadmap</h2>
          <p>Investment priorities and delivery milestones across the next 12 months.</p>
        </div>
        <div className="landing-roadmap">
          <div>
            <h3>Q1 - Q2</h3>
            <ul>
              <li>Expand sensor coverage to priority districts.</li>
              <li>Launch executive KPI suite for leadership reporting.</li>
              <li>Automate partner onboarding for private haulers.</li>
            </ul>
          </div>
          <div>
            <h3>Q3</h3>
            <ul>
              <li>Predictive route optimization with dynamic dispatch.</li>
              <li>Citywide contamination analytics and impact scoring.</li>
              <li>Carbon reporting dashboard for ESG goals.</li>
            </ul>
          </div>
          <div>
            <h3>Q4</h3>
            <ul>
              <li>Multi-city benchmarking and regional insights.</li>
              <li>Marketplace integrations for recycling processors.</li>
              <li>Open data portal for stakeholder transparency.</li>
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
                Thanks! We&apos;ll follow up with a tailored demo and deployment plan.
              </p>
            )}
          </form>

          <aside className="landing-contact-info">
            <h3>Recommended AWS contact form</h3>
            <p>
              For production, we recommend an API Gateway + Lambda endpoint that stores submissions in
              DynamoDB and sends notifications through Amazon SES. Add AWS WAF or reCAPTCHA for spam
              protection, and CloudWatch alarms for operational visibility.
            </p>
            <div className="landing-contact-highlight">
              <p>Need deeper analytics?</p>
              <ul>
                <li>Track section engagement with Google Analytics events.</li>
                <li>Measure scroll depth and CTA conversion rates.</li>
                <li>Map high-interest sections to investor questions.</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <footer className="landing-footer">
        <div>
          <strong>EcoScan</strong>
          <p>Intelligent waste operations for modern cities.</p>
        </div>
        <div>
          <p>Contact: partnerships@ecoscan.ai</p>
          <p>© 2024 EcoScan. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
