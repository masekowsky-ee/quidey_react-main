import { createContext, useContext } from 'react'
import  translations  from './translations'
import {useSelector, useDispatch} from 'react-redux'
import {setLanguage} from '../features/settings/settingsAction'

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const language = useSelector((state) => state.settings.language);

  const dispatch = useDispatch();

  const setLanguageFunc = (languageKey) => {
    dispatch(setLanguage(languageKey))
  }

  const t = (key, second = null) => {
    const value = translations[language]?.[key]
    if (second !== null && second !== undefined) return value?.[second] ?? key
    return value ?? key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguageFunc,  t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  return useContext(LanguageContext)
}