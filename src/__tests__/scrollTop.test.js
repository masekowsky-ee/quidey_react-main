import { describe, it, expect, vi, afterEach } from 'vitest'
import { isOnPlace, topOnSamePlace } from '../features/layout/scrollTop'

afterEach(() => vi.restoreAllMocks())

describe('nav tap on the page you are on', () => {
    it('knows the place and the pages below it', () => {
        expect(isOnPlace('/study', '/study')).toBe(true)
        expect(isOnPlace('/study/5', '/study')).toBe(true)
        expect(isOnPlace('/studyx', '/study')).toBe(false)
        expect(isOnPlace('/', '/')).toBe(true)
        expect(isOnPlace('/calendar', '/')).toBe(false)
        expect(isOnPlace('/together/3', '/community', (p) => p.startsWith('/together'))).toBe(true)
    })

    it('scrolls to the top on the same place, leaves the scroll alone elsewhere', () => {
        const scrollTo = vi.fn()
        window.scrollTo = scrollTo
        const after = vi.fn()
        topOnSamePlace('/study', '/study', undefined, after)({})
        expect(scrollTo).toHaveBeenCalledTimes(1)
        expect(scrollTo.mock.calls[0][0]).toMatchObject({ top: 0 })
        expect(after).toHaveBeenCalledTimes(1)
        topOnSamePlace('/calendar', '/study')({})
        expect(scrollTo).toHaveBeenCalledTimes(1)
    })
})
