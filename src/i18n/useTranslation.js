import { useEffect, useSyncExternalStore } from 'react'
import { useSelector } from 'react-redux'
import translations, { loadLanguage, loadedVersion, onLanguageLoaded } from './translations'

// Looks up a translation. `index` picks an entry from list values
// (e.g. translate('de', 'months', 0) -> 'Januar'). Falls back to the key itself.
export function translate(language, key, index = null) {
    // a language still downloading shows the loaded one instead of bare keys
    const texts = translations[language] ?? Object.values(translations)[0]
    const value = texts?.[key]
    if (index !== null && index !== undefined) return value?.[index] ?? key
    return value ?? key
}

// The current language comes from the settings slice, so every component
// re-renders with the new texts as soon as the language changes. A language that is not
// downloaded yet is fetched here; until it arrives translate() answers from the loaded one.
export function useTranslation() {
    const language = useSelector((state) => state.settings.language)
    useSyncExternalStore(onLanguageLoaded, loadedVersion)
    useEffect(() => { loadLanguage(language) }, [language])
    const t = (key, index = null) => translate(language, key, index)
    return { language, t }
}
