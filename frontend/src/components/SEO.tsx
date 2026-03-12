import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

interface SEOProps {
  titleKey: string
  descriptionKey: string
  noindex?: boolean
  canonical?: string
}

export default function SEO({ titleKey, descriptionKey, noindex, canonical }: SEOProps) {
  const { t } = useTranslation()
  const title = `${t(titleKey)} | EcoScan`
  const description = t(descriptionKey)

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}
    </Helmet>
  )
}
