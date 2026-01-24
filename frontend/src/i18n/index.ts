import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import cs from './locales/cs.json'
import de from './locales/de.json'

export const supportedLanguages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      cs: { translation: cs },
      de: { translation: de },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'cs', 'de'],
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      lookupQuerystring: 'lang',
      caches: ['localStorage'],
      lookupLocalStorage: 'ecoscan-language',
    },
  })

export default i18n
