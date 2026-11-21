import { useSelector } from 'react-redux'

// The BCP 47 locale for dates and numbers: German for 'de', British English for anything else.
export const localeOf = (language) => (language === 'de' ? 'de-DE' : 'en-GB')

export const useLocale = () => localeOf(useSelector((state) => state.settings.language))
