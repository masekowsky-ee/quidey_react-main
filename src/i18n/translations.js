// The app's texts, one chunk per language (./de, ./en): only the language in use is downloaded.
// `translations` fills up as languages load; main.jsx waits for the first one before rendering,
// and useTranslation loads another one when the language is switched.
const translations = {}

const loaders = {
    de: () => import('./de'),
    en: () => import('./en'),
}

const pending = {}
const listeners = new Set()
let version = 0

export function loadLanguage(language) {
    const load = loaders[language]
    if (!load || translations[language]) return Promise.resolve()
    pending[language] ??= load().then((module) => {
        translations[language] = module.default
        version += 1
        listeners.forEach((listener) => listener())
    })
    return pending[language]
}

export function onLanguageLoaded(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export const loadedVersion = () => version

export default translations
