import { describe, it, expect } from 'vitest'
import { showsAddFab } from '../features/layout/addFab'

describe('the round add button', () => {
    it('is on Start, Kalender, Fokusraum, families and sessions only', () => {
        for (const path of ['/', '/calendar', '/focus', '/family/3', '/together/12', '/community/sessions', '/community/family']) {
            expect(showsAddFab(path), path).toBe(true)
        }
        for (const path of ['/community', '/community/friends', '/community/progress', '/inbox', '/stats', '/settings', '/profile', '/notes', '/routines', '/u/ann', '/arcade']) {
            expect(showsAddFab(path), path).toBe(false)
        }
    })
})
