import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { setTimer } from '../features/session/sessionAction'
import { useFocusAway } from '../features/focus/useFocusAway'
import { readTally } from '../features/focus/away'

function Tracker({ platform }) {
    useFocusAway(true, platform)
    return null
}

let hidden = false
const setHidden = (value) => {
    hidden = value
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
}

const setup = (platform = 'desktop') => {
    const store = configureStore({ reducer: rootReducer })
    render(<Provider store={store}><Tracker platform={platform} /></Provider>)
    return store
}
const toasts = (store) => store.getState().toast.toasts ?? store.getState().toast

describe('leaving the app during focus (computer browser)', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        localStorage.removeItem('focusAway')
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') })
    })
    afterEach(() => {
        vi.useRealTimers()
        hidden = false
    })

    it('counts time in another tab while the round runs and says so on return', () => {
        const store = setup()
        act(() => { store.dispatch(setTimer(25 * 60000, true)) })
        setHidden(true)
        act(() => { vi.advanceTimersByTime(2 * 60000) })
        setHidden(false)
        expect(readTally()).toMatchObject({ count: 1, round: { count: 1 } })
        expect(JSON.stringify(toasts(store))).toContain('Willkommen zurück')
    })

    it('a computer that slept meanwhile counts nothing', () => {
        const store = setup()
        act(() => { store.dispatch(setTimer(25 * 60000, true)) })
        setHidden(true)
        // no beats while asleep: the clock jumps, no timer runs
        vi.setSystemTime(Date.now() + 10 * 60000)
        setHidden(false)
        expect(readTally().count).toBe(0)
        expect(JSON.stringify(toasts(store))).not.toContain('Willkommen zurück')
    })

    it('a paused timer or a short look counts nothing', () => {
        const store = setup()
        act(() => { store.dispatch(setTimer(20 * 60000, true)) })
        setHidden(true)
        act(() => { vi.advanceTimersByTime(5000) })
        setHidden(false)
        act(() => { store.dispatch(setTimer(20 * 60000, false)) })
        setHidden(true)
        act(() => { vi.advanceTimersByTime(60000) })
        setHidden(false)
        expect(readTally().count).toBe(0)
    })

    it('a new round starts at nought, the last one is kept for the recap', () => {
        const store = setup()
        act(() => { store.dispatch(setTimer(25 * 60000, true)) })
        setHidden(true)
        act(() => { vi.advanceTimersByTime(30000) })
        setHidden(false)
        act(() => { store.dispatch(setTimer(0, false)) })
        expect(readTally()).toMatchObject({ lastRound: { count: 1 } })
        act(() => { store.dispatch(setTimer(25 * 60000, true)) })
        expect(readTally()).toMatchObject({ round: { count: 0 }, lastRound: { count: 1 } })
    })

    it('does nothing where it can\'t tell a screen turned off (phone browser)', () => {
        const store = setup(null)
        act(() => { store.dispatch(setTimer(25 * 60000, true)) })
        setHidden(true)
        act(() => { vi.advanceTimersByTime(2 * 60000) })
        setHidden(false)
        expect(readTally().count).toBe(0)
    })
})
