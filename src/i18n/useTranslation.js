import { useSelector } from 'react-redux'
import translations from './translations'

// Looks up a translation. `index` picks an entry from list values
// (e.g. translate('de', 'months', 0) -> 'Januar'). Falls back to the key itself.
export function translate(language, key, index = null) {
  const value = translations[language]?.[key]
  if (index !== null && index !== undefined) return value?.[index] ?? key
  return value ?? key
}

// The current language comes from the settings slice, so every component
// re-renders with the new texts as soon as the language changes.
export function useTranslation() {
  const language = useSelector((state) => state.settings.language)
  const t = (key, index = null) => translate(language, key, index)
  return { language, t }
}
