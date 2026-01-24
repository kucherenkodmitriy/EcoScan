import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supportedLanguages } from '../i18n'
import './LanguageSelector.css'

interface LanguageSelectorProps {
  variant?: 'default' | 'landing'
}

export default function LanguageSelector({ variant = 'default' }: LanguageSelectorProps) {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLang = supportedLanguages.find((lang) => lang.code === i18n.language) || supportedLanguages[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Update html lang attribute when language changes
  useEffect(() => {
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode)
    setIsOpen(false)

    // Update URL with lang parameter for SEO without full page reload
    const url = new URL(window.location.href)
    if (langCode === 'en') {
      url.searchParams.delete('lang')
    } else {
      url.searchParams.set('lang', langCode)
    }
    window.history.replaceState({}, '', url.toString())
  }

  return (
    <div
      className={`language-selector ${variant === 'landing' ? 'language-selector--landing' : ''}`}
      ref={dropdownRef}
    >
      <button
        className="language-selector__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="language-selector__flag">{currentLang.flag}</span>
        <span className="language-selector__code">{currentLang.code.toUpperCase()}</span>
        <svg
          className={`language-selector__arrow ${isOpen ? 'language-selector__arrow--open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {isOpen && (
        <ul className="language-selector__dropdown" role="listbox">
          {supportedLanguages.map((lang) => (
            <li key={lang.code}>
              <button
                className={`language-selector__option ${
                  lang.code === i18n.language ? 'language-selector__option--active' : ''
                }`}
                onClick={() => handleLanguageChange(lang.code)}
                role="option"
                aria-selected={lang.code === i18n.language}
              >
                <span className="language-selector__flag">{lang.flag}</span>
                <span className="language-selector__name">{lang.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
