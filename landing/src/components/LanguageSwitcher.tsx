import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supportedLanguages } from '../i18n'
import styles from './LanguageSwitcher.module.css'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLang = supportedLanguages.find(lang => lang.code === i18n.language) || supportedLanguages[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode)
    setIsOpen(false)
  }

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={styles.flag}>{currentLang.flag}</span>
        <span className={styles.code}>{currentLang.code.toUpperCase()}</span>
        <svg
          className={`${styles.chevron} ${isOpen ? styles.open : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>

      {isOpen && (
        <ul className={styles.dropdown} role="listbox">
          {supportedLanguages.map((lang) => (
            <li
              key={lang.code}
              className={`${styles.option} ${lang.code === i18n.language ? styles.selected : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
              role="option"
              aria-selected={lang.code === i18n.language}
            >
              <span className={styles.flag}>{lang.flag}</span>
              <span className={styles.name}>{lang.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
