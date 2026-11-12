import { describe, it, expect } from 'vitest'
import { toggleKind, HOME_KINDS } from '../features/home/kinds.js'

describe('Home kind filter', () => {
    it('turns one off and on again', () => {
        const off = toggleKind(HOME_KINDS, 'tasks')
        expect(off).toEqual(['events', 'reminders', 'notes'])
        // turning anything on while notes show switches the notes off
        expect(toggleKind(off, 'tasks')).toEqual(['tasks', 'events', 'reminders'])
        expect(toggleKind(['tasks', 'events'], 'reminders')).toEqual(['tasks', 'events', 'reminders'])
    })
    it('tapping notes leaves only the notes, again brings everything back', () => {
        expect(toggleKind(HOME_KINDS, 'notes')).toEqual(['notes'])
        expect(toggleKind(['tasks', 'events'], 'notes')).toEqual(['notes'])
        expect(toggleKind(['notes'], 'notes')).toEqual(HOME_KINDS)
    })
    it('turning another on while notes show switches notes off', () => {
        expect(toggleKind(['notes'], 'tasks')).toEqual(['tasks'])
    })
    it('the last one cannot be switched off', () => {
        expect(toggleKind(['events'], 'events')).toEqual(HOME_KINDS)
    })
})
