import { describe, it, expect } from 'vitest'
import { decideUpdate, DISMISS_MS } from '../features/native/appUpdate'

const server = (change = {}) => ({ latest: { code: 12, name: '1.2.0' }, minSupported: 8, updateAvailable: false, mustUpdate: false, ...change })

describe('decideUpdate', () => {
    it('says nothing when both sources are quiet', () => {
        expect(decideUpdate(server(), null)).toBe('none')
        expect(decideUpdate(null, null)).toBe('none')
        expect(decideUpdate(null, { available: false })).toBe('none')
    })

    it('offers an update when the server or Play knows a newer build', () => {
        expect(decideUpdate(server({ updateAvailable: true }), null)).toBe('available')
        expect(decideUpdate(null, { available: true, versionCode: 12, priority: 0 })).toBe('available')
    })

    it('insists when the build is below the minimum, or Play marks the update most urgent', () => {
        expect(decideUpdate(server({ mustUpdate: true, updateAvailable: true }), null)).toBe('required')
        expect(decideUpdate(null, { available: true, versionCode: 12, priority: 5 })).toBe('required')
        expect(decideUpdate(null, { available: true, versionCode: 12, priority: 4 })).toBe('available')
    })

    it('lets "later" rest the offer for a while, but not for a newer build or a required update', () => {
        const now = 1_000_000_000_000
        const later = (change) => ({ dismissedFor: 12, dismissedAt: now - 1000, now, ...change })
        expect(decideUpdate(server({ updateAvailable: true }), null, later())).toBe('none')
        expect(decideUpdate(server({ updateAvailable: true }), null, later({ dismissedAt: now - DISMISS_MS - 1 }))).toBe('available')
        expect(decideUpdate(server({ updateAvailable: true, latest: { code: 13 } }), null, later())).toBe('available')
        expect(decideUpdate(server({ updateAvailable: true, mustUpdate: true }), null, later())).toBe('required')
    })
})
