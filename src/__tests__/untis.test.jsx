import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { setLanguage } from '../features/settings/settingsAction'
import { lessonsToEntries, rememberUntisStatus } from '../features/untis/untis'
import UntisSettings from '../components/untis/UntisSettings'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const CONNECTED = { available: true, connected: true, mode: 'login', schoolLabel: 'Gymnasium Musterstadt', username: 'lena', lastSyncAt: '2026-11-09T09:00:00.000Z', lastError: null }
const call = (path, method) => apiFetch.mock.calls.find(([url, o]) => url === path && (o?.method ?? 'GET') === method)

describe('lessons as calendar entries', () => {
    it('read-only events with their time, length, room and status', () => {
        expect(lessonsToEntries([{ id: 5, day: '2026-11-19', start: '08:00', end: '09:35', subject: 'M', subjectLong: 'Mathematik', room: 'R12', className: '10b', status: 'cancelled', info: 'Entfall' }])).toEqual([
            expect.objectContaining({
                id: 'lesson-5', kind: 'event', name: 'Mathematik', due: '2026-11-19', due_time: '08:00', duration_minutes: 95,
                location: 'R12', done: false, lesson: { status: 'cancelled', info: 'Entfall', subjectLong: 'Mathematik', className: '10b' },
            }),
        ])
    })
})

describe('connecting the timetable in the settings', () => {
    let answers
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        rememberUntisStatus(null)
        answers = { status: { available: true, connected: false } }
        apiFetch.mockReset()
        apiFetch.mockImplementation(async (url, options = {}) => {
            const method = options.method ?? 'GET'
            if (url === '/api/untis' && method === 'GET') return answers.status
            if (url.startsWith('/api/untis/schools')) return [{ server: 'neilo.webuntis.com', school: 'gym-muster', label: 'Gymnasium Musterstadt', address: 'Musterstadt' }]
            if (url === '/api/untis' && method === 'PUT') {
                const body = JSON.parse(options.body)
                if (body.password === 'falsch') throw Object.assign(new Error('no'), { code: 'UNTIS_LOGIN_FAILED', status: 400 })
                return CONNECTED
            }
            if (url === '/api/untis' && method === 'DELETE') return null
            return {}
        })
    })
    afterEach(() => vi.useRealTimers())

    const open = async () => {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch(setLanguage('de'))
        await act(async () => { render(<Provider store={store}><UntisSettings /></Provider>) })
    }

    it('finds the school, signs in, and shows what is connected', async () => {
        await open()
        fireEvent.change(screen.getByRole('searchbox', { name: 'Schule suchen' }), { target: { value: 'Muster' } })
        await act(async () => { await vi.advanceTimersByTimeAsync(500) })
        fireEvent.click(screen.getByRole('button', { name: /Gymnasium Musterstadt/ }))
        fireEvent.change(screen.getByLabelText('Untis-Benutzername'), { target: { value: 'lena' } })
        fireEvent.change(screen.getByLabelText('Untis-Passwort'), { target: { value: 'richtig' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Verbinden' })) })
        expect(JSON.parse(call('/api/untis', 'PUT')[1].body)).toEqual({
            mode: 'login', server: 'neilo.webuntis.com', school: 'gym-muster', schoolLabel: 'Gymnasium Musterstadt', username: 'lena', password: 'richtig',
        })
        expect(screen.getByText(/Gymnasium Musterstadt/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Jetzt aktualisieren' })).toBeInTheDocument()
        // the password isn't kept in the page afterwards
        expect(screen.queryByLabelText('Untis-Passwort')).toBeNull()
    })

    it('a wrong password says so', async () => {
        await open()
        fireEvent.click(screen.getByRole('button', { name: 'Schule selbst eingeben' }))
        fireEvent.change(screen.getByLabelText('Untis-Server'), { target: { value: 'neilo.webuntis.com' } })
        fireEvent.change(screen.getByLabelText('Schulname in Untis'), { target: { value: 'gym-muster' } })
        fireEvent.change(screen.getByLabelText('Untis-Benutzername'), { target: { value: 'lena' } })
        fireEvent.change(screen.getByLabelText('Untis-Passwort'), { target: { value: 'falsch' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Verbinden' })) })
        expect(screen.getByRole('alert')).toHaveTextContent(/Benutzername oder Passwort/)
    })

    it('the iCal link works without a password', async () => {
        await open()
        fireEvent.click(screen.getByRole('tab', { name: 'iCal-Link' }))
        fireEvent.change(screen.getByLabelText('iCal-Link aus WebUntis'), { target: { value: 'https://neilo.webuntis.com/WebUntis/Ical.do?key=abc' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Verbinden' })) })
        expect(JSON.parse(call('/api/untis', 'PUT')[1].body)).toEqual({ mode: 'ical', url: 'https://neilo.webuntis.com/WebUntis/Ical.do?key=abc' })
    })

    it('disconnecting asks once and deletes', async () => {
        answers.status = CONNECTED
        await open()
        fireEvent.click(screen.getByRole('button', { name: 'Trennen' }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Wirklich trennen|Trennen\?|Ja/ })) })
        expect(call('/api/untis', 'DELETE')).toBeTruthy()
        expect(screen.getByRole('searchbox', { name: 'Schule suchen' })).toBeInTheDocument()
    })

    it('not set up on this server: says so', async () => {
        answers.status = { available: false, connected: false }
        await open()
        expect(screen.getByText(/noch nicht eingerichtet/)).toBeInTheDocument()
    })
})
