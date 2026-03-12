import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '../components/SEO'

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <SEO titleKey="meta.notFound.title" descriptionKey="meta.notFound.description" noindex />
      <h1 style={{ fontSize: '4rem', margin: '0 0 0.5rem' }}>404</h1>
      <p style={{ fontSize: '1.25rem', color: '#666', marginBottom: '2rem' }}>
        {t('meta.notFound.heading')}
      </p>
      <Link to="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>
        {t('meta.notFound.backHome')}
      </Link>
    </div>
  )
}
