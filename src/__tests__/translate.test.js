import { describe, it, expect } from 'vitest'
import { translate } from '../i18n/useTranslation'
import translations from '../i18n/translations'

describe('translate', () => {
    it('looks up a key in the given language', () => {
        expect(translate('de', 'settings')).toBe('Einstellungen')
        expect(translate('en', 'settings')).toBe('Settings')
    })

    it('picks an entry from list values by index', () => {
        expect(translate('en', 'months', 0)).toBe('January')
        expect(translate('de', 'weekDays', 6)).toBe('So')
    })

    it('falls back to the key when it is missing', () => {
        expect(translate('de', 'doesNotExist')).toBe('doesNotExist')
        expect(translate('en', 'months', 99)).toBe('months')
    })

    it('treats index 0 as a real index, not as "no index"', () => {
        expect(translate('en', 'weekDays', 0)).toBe('Mo')
    })
})

// Catches a key added to one language but forgotten in the other
describe('translation files', () => {
    it('German and English have the same keys', () => {
        const de = Object.keys(translations.de).sort()
        const en = Object.keys(translations.en).sort()
        expect(de).toEqual(en)
    })

    it('list values have the same length in both languages', () => {
        for (const key of Object.keys(translations.en)) {
            if (Array.isArray(translations.en[key])) {
                expect(translations.de[key], key).toHaveLength(translations.en[key].length)
            }
        }
    })
})
