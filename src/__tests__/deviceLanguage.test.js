import { describe, it, expect, afterEach } from 'vitest'
import { deviceLanguage, readStoredLanguage } from '../features/settings/preferences'

const setDevice = (...languages) => {
    Object.defineProperty(window.navigator, 'language', { value: languages[0], configurable: true })
    Object.defineProperty(window.navigator, 'languages', { value: languages, configurable: true })
}

describe('the device language', () => {
    afterEach(() => { setDevice('de-DE', 'de'); localStorage.clear() })

    it('German on a German device (any region), English on every other', () => {
        setDevice('de-AT')
        expect(deviceLanguage()).toBe('de')
        setDevice('de')
        expect(deviceLanguage()).toBe('de')
        setDevice('en-GB')
        expect(deviceLanguage()).toBe('en')
        setDevice('fr-FR', 'de-DE')
        expect(deviceLanguage()).toBe('en')
        setDevice('tr')
        expect(deviceLanguage()).toBe('en')
    })

    it('is the language until one is picked; a picked one wins', () => {
        setDevice('es-ES')
        expect(readStoredLanguage()).toBe('en')
        localStorage.setItem('language', 'de')
        expect(readStoredLanguage()).toBe('de')
    })
})
