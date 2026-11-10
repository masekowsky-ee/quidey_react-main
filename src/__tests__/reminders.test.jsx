import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS } from '../features/auth/authActionTypes'
import { occurrences, nextOccurrence, dueOccurrence, isMissed, sortReminders, fetchReminders } from '../features/reminders/reminders'
import { alarmsFor } from '../features/native/alarms'
import { showForms } from '../features/settings/settingsAction'
import QuickAdd from '../components/QuickAdd'
import ReminderList from '../components/reminders/ReminderList'
import ReminderAlert from '../components/reminders/ReminderAlert'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))
vi.mock('../features/settings/sound', async (importOriginal) => ({
    ...(await importOriginal()),
    playSound: vi.fn(),
}))

function makeStore({ isTester = true } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isTester, userId: 1 } })
    return store
}
const wrap = (ui, store) => render(<Provider store={store}><MemoryRouter>{ui}</MemoryRouter></Provider>)

// Wednesday, 4 November 2026, 10:00 local time
const NOW = new Date(2026, 10, 4, 10, 0)
const at = (day, h, m = 0) => new Date(2026, 10, day, h, m)
const once = (extra = {}) => ({ id: 1, text: 'Mama anrufen', at: at(4, 18).toISOString(), days: null, atTime: null, snoozedUntil: null, doneAt: null, ...extra })
const weekly = (extra = {}) => ({ id: 2, text: 'Tabletten', at: null, days: [1, 3, 5], atTime: '07:30', snoozedUntil: null, doneAt: null, ...extra })

describe('when a reminder rings', () => {
    it('once: at its time, at the snooze instead once snoozed, never when done', () => {
        expect(nextOccurrence(once(), NOW)).toEqual(at(4, 18))
        expect(nextOccurrence(once({ snoozedUntil: at(4, 18, 10).toISOString() }), NOW)).toEqual(at(4, 18, 10))
        expect(nextOccurrence(once({ doneAt: NOW.toISOString() }), NOW)).toBeNull()
    })

    it('weekly: on its weekdays at its time, the next one from now', () => {
        // Wednesday 07:30 is over: Friday 07:30
        expect(nextOccurrence(weekly(), NOW)).toEqual(at(6, 7, 30))
        expect(occurrences(weekly(), at(2, 0), at(8, 23)).map(d => d.getDate())).toEqual([2, 4, 6])
    })

    it('due for ten minutes after its time, then a once reminder counts as missed', () => {
        const r = once({ at: at(4, 9, 55).toISOString() })
        expect(dueOccurrence(r, NOW)).toEqual(at(4, 9, 55))
        expect(isMissed(r, NOW)).toBe(false)
        const later = new Date(2026, 10, 4, 10, 10)
        expect(dueOccurrence(r, later)).toBeNull()
        expect(isMissed(r, later)).toBe(true)
        expect(isMissed(weekly(), later)).toBe(false)
    })

    it('the list: due first, then missed, then by the next time, done last', () => {
        const due = once({ id: 10, at: at(4, 9, 58).toISOString() })
        const missed = once({ id: 11, at: at(4, 8).toISOString() })
        const soon = once({ id: 12, at: at(4, 11).toISOString() })
        const done = once({ id: 13, doneAt: at(3, 9).toISOString() })
        expect(sortReminders([done, weekly(), soon, missed, due], NOW).map(r => r.id)).toEqual([10, 11, 12, 2, 13])
    })

    it('the Android alarm clock gets every coming time of the next two weeks, soonest first', () => {
        const alarms = alarmsFor([weekly(), once()], NOW)
        expect(alarms[0]).toEqual({ reminderId: 1, text: 'Mama anrufen', at: at(4, 18).getTime() })
        expect(alarms.filter(a => a.reminderId === 2)).toHaveLength(6)
        expect(alarms.map(a => a.at)).toEqual([...alarms.map(a => a.at)].sort((a, b) => a - b))
    })
})

describe('reminders in the app (testers)', () => {
    beforeEach(() => {
        apiFetch.mockReset()
        localStorage.removeItem('reminderSeen')
    })
    afterEach(() => vi.useRealTimers())

    it('the new-task form switches to a reminder and takes the typed text along; a time in it is used', async () => {
        // 10:00, so 18 Uhr today is still to come
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const store = makeStore()
        store.dispatch(showForms(true))
        wrap(<QuickAdd />, store)
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mama anrufen 18 Uhr' } })
        fireEvent.click(screen.getByLabelText(/Erinnerung/))

        const text = screen.getByLabelText('Woran soll Quidey dich erinnern?')
        expect(text).toHaveValue('Mama anrufen 18 Uhr')
        expect(screen.getByText(/18:00 Uhr/)).toBeInTheDocument()

        const saved = once({ id: 7, at: new Date(new Date().setHours(18, 0, 0, 0)).toISOString() })
        apiFetch.mockResolvedValueOnce(saved)
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })) })
        // (the task form asked for the friends before)
        const [, init] = apiFetch.mock.calls.find(([path]) => path === '/api/tester/reminders')
        const body = JSON.parse(init.body)
        expect(body.text).toBe('Mama anrufen')
        expect(new Date(body.at).getHours()).toBe(18)
        expect(store.getState().reminders.list).toEqual([saved])
    })

    it('weekdays need at least one day', async () => {
        const store = makeStore()
        store.dispatch(showForms('reminder'))
        wrap(<QuickAdd />, store)
        fireEvent.change(screen.getByLabelText('Woran soll Quidey dich erinnern?'), { target: { value: 'Tabletten' } })
        fireEvent.click(screen.getByRole('radio', { name: 'An Wochentagen' }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })) })
        expect(screen.getByRole('alert')).toHaveTextContent('Wähle mindestens einen Tag.')
        expect(apiFetch).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Mo' }))
        fireEvent.click(screen.getByRole('button', { name: 'Fr' }))
        apiFetch.mockResolvedValueOnce(weekly({ days: [1, 5] }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })) })
        expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual(expect.objectContaining({ text: 'Tabletten', days: [1, 5] }))
    })

    it('everybody gets the reminder choice, not only testers', () => {
        const store = makeStore({ isTester: false })
        store.dispatch(showForms('reminder'))
        wrap(<QuickAdd />, store)
        expect(screen.getAllByLabelText(/Erinnerung/).length).toBeGreaterThan(0)
    })

    it('the inbox lists mine; a due one can be marked done', async () => {
        const store = makeStore()
        const due = once({ id: 3, text: 'Wäsche', at: new Date(Date.now() - 60e3).toISOString() })
        apiFetch.mockResolvedValueOnce([due, weekly()])
        await store.dispatch(fetchReminders())
        wrap(<ReminderList />, store)
        expect(screen.getByText('Wäsche')).toBeInTheDocument()
        expect(screen.getByText('Jetzt fällig')).toBeInTheDocument()
        expect(screen.getByText(/Mo, Mi, Fr · 07:30/)).toBeInTheDocument()

        apiFetch.mockResolvedValueOnce({ ...due, doneAt: new Date().toISOString() })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erledigt' })) })
        expect(apiFetch).toHaveBeenLastCalledWith('/api/tester/reminders/3/done', { method: 'POST' })
    })

    it('a due one covers the page while the app is open, once', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValueOnce([once({ id: 4, text: 'Pizza aus dem Ofen', at: new Date(Date.now() - 30e3).toISOString() })])
        await store.dispatch(fetchReminders())
        const { unmount } = wrap(<ReminderAlert />, store)
        await act(async () => { await new Promise(r => setTimeout(r, 10)) })
        expect(screen.getByRole('alertdialog')).toHaveTextContent('Pizza aus dem Ofen')

        apiFetch.mockResolvedValueOnce(once({ id: 4, snoozedUntil: new Date(Date.now() + 600e3).toISOString() }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '10 Min. später' })) })
        expect(apiFetch).toHaveBeenLastCalledWith('/api/tester/reminders/4/snooze', expect.objectContaining({ method: 'POST', body: '{"minutes":10}' }))
        expect(screen.queryByRole('alertdialog')).toBeNull()
        unmount()
    })
})
