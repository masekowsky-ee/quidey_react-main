import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { setTimer, setTimerMode, setSessionParams, clockTick } from '../features/session/sessionAction'
import { focusNotice } from '../features/session/focusNotification'
import { focusTitle, useFocusTitle } from '../features/session/focusTitle'
import { readStoredPomodoro } from '../features/settings/preferences'
import DurationInput from '../components/focus/DurationInput'

const makeStore = () => configureStore({ reducer: rootReducer })

describe('the lasting focus notification', () => {
    afterEach(() => vi.useRealTimers())

    it('none while nothing is on; a countdown counts to its end, the same on every tick', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-11-04T08:00:00Z'))
        const store = makeStore()
        store.dispatch(setTimerMode('timer'))
        expect(focusNotice(store.getState(), 'de')).toBeNull()

        store.dispatch(setSessionParams({ time: 25 * 60000 }))
        store.dispatch(setTimer(25 * 60000, true))
        const first = focusNotice(store.getState(), 'de')
        expect(first).toMatchObject({ title: 'Fokus läuft', running: true, countDown: true, base: Date.parse('2026-11-04T08:25:00Z') })

        vi.setSystemTime(new Date('2026-11-04T08:00:03Z'))
        store.dispatch(clockTick(3, null))
        expect(focusNotice(store.getState(), 'de').base).toBe(first.base)
    })

    it('a stopwatch counts up from its start; paused it shows the time standing', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-11-04T08:00:00Z'))
        const store = makeStore()
        store.dispatch(setTimerMode('stopwatch'))
        store.dispatch(setTimer(0, true))
        vi.setSystemTime(new Date('2026-11-04T08:01:05Z'))
        store.dispatch(clockTick(65, null))
        expect(focusNotice(store.getState(), 'en')).toMatchObject({ countDown: false, base: Date.parse('2026-11-04T08:00:00Z') })

        store.dispatch(setTimer(65000, false))
        expect(focusNotice(store.getState(), 'en')).toMatchObject({ running: false, time: '1:05', title: 'Focus running · paused' })
    })
})

describe('the running timer in the tab title', () => {
    afterEach(() => { vi.useRealTimers(); document.title = 'Quidey' })

    it('counts from the wall clock: down for a countdown, up for a stopwatch, a break by its name', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-11-04T08:00:00Z'))
        const store = makeStore()
        store.dispatch(setTimerMode('timer'))
        expect(focusTitle(store.getState(), 'de', Date.now())).toBeNull()
        store.dispatch(setTimer(25 * 60000, true))
        // no tick booked yet (a frozen tab): still the right second
        expect(focusTitle(store.getState(), 'de', Date.now() + 61400)).toBe('▶ 23:59 · Fokus')

        store.dispatch(setTimerMode('stopwatch'))
        store.dispatch(setTimer(0, true))
        expect(focusTitle(store.getState(), 'en', Date.now() + 3725000)).toBe('▶ 1:02:05 · Focus')
    })

    it('shows while it runs and gives the old title back once it is paused', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-11-04T08:00:00Z'))
        document.title = 'Quidey'
        const store = makeStore()
        store.dispatch(setTimerMode('timer'))
        function Probe() { useFocusTitle(true); return null }
        render(<Provider store={store}><Probe /></Provider>)
        expect(document.title).toBe('Quidey')
        act(() => { store.dispatch(setTimer(10 * 60000, true)) })
        expect(document.title).toBe('▶ 10:00 · Fokus')
        act(() => { vi.advanceTimersByTime(5000) })
        expect(document.title).toBe('▶ 9:55 · Fokus')
        act(() => { store.dispatch(setTimer(595000, false)) })
        expect(document.title).toBe('Quidey')
    })
})

describe('lengths typed freely', () => {
    beforeEach(() => localStorage.clear())

    it('hours, minutes and seconds make the length; nothing at all is not one', () => {
        const onChange = vi.fn()
        const store = makeStore()
        render(<Provider store={store}><DurationInput ms={30 * 60000} onChange={onChange} label="Länge" presets={[15]} /></Provider>)
        fireEvent.change(screen.getByLabelText('Minuten'), { target: { value: '7' } })
        expect(onChange).toHaveBeenLastCalledWith(7 * 60000)
        fireEvent.change(screen.getByLabelText('Sekunden'), { target: { value: '45' } })
        expect(onChange).toHaveBeenLastCalledWith(7 * 60000 + 45000)
        fireEvent.change(screen.getByLabelText('Sekunden'), { target: { value: '0' } })
        onChange.mockClear()
        fireEvent.change(screen.getByLabelText('Minuten'), { target: { value: '0' } })
        expect(onChange).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: '15' }))
        expect(onChange).toHaveBeenLastCalledWith(15 * 60000)
    })

    it('own Pomodoro lengths are kept for the next visit; impossible ones fall back', () => {
        localStorage.setItem('pomodoro', JSON.stringify({ focus: 37, short: 2, long: 400, every: 3 }))
        expect(readStoredPomodoro()).toEqual({ focus: 37, short: 2, long: 15, every: 3 })
    })
})
