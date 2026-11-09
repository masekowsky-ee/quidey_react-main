import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE, SET_EVENT_TYPES } from '../features/tasks/taskActionTypes'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import { forgetAiQuota } from '../features/ai/ai'
import TaskForm from '../components/TaskForm'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

// Monday, 9 Nov 2026, 10:00
const NOW = new Date(2026, 10, 9, 10, 0)
const TYPES = [{ id: 4, name: 'School', color: null, keywords: [] }]
const QUOTA = { available: true, scan: { used: 0, max: 1 }, aiLine: { used: 0, max: 5 }, resetsAt: '2026-11-09T23:00:00.000Z' }

const posted = (path) => {
    const call = apiFetch.mock.calls.find(([url, options]) => url === path && options?.method === 'POST')
    return call && JSON.parse(call[1].body)
}

function open() {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('en'))
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester: false, adminPendingCount: 0, betaRequest: null } })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [], groups: [], notes: [] } })
    store.dispatch({ type: SET_EVENT_TYPES, payload: TYPES })
    render(<Provider store={store}><MemoryRouter><TaskForm setCreateTask={vi.fn()} /></MemoryRouter></Provider>)
    return store
}
const type = (value) => fireEvent.change(screen.getByRole('textbox', { name: /name/i }), { target: { value } })
const create = async () => {
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })) })
}

describe('quick entry 2.0 in the new-entry form', () => {
    let aiAnswer
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        forgetAiQuota()
        aiAnswer = null
        apiFetch.mockReset()
        apiFetch.mockImplementation(async (url, options = {}) => {
            if (url === '/api/ai/quota') return structuredClone(QUOTA)
            if (url === '/api/ai/parse-entry') {
                if (aiAnswer instanceof Error) throw aiAnswer
                return { entry: aiAnswer, quota: { ...QUOTA, aiLine: { used: 1, max: 5 } } }
            }
            if (url === '/api/tasks' && options.method === 'POST') return { id: 50, ...JSON.parse(options.body) }
            return {}
        })
    })
    afterEach(() => vi.useRealTimers())

    it('the example line becomes an event with its time, length, colour, type and reminder', async () => {
        open()
        type('Study 19.11. 13:00 - 15:00 blue type: school, reminder 15 mins prior.')
        const hint = screen.getByText(/Found:/).textContent
        for (const part of ['Event', '13:00', '15:00', 'Blue', 'School', '15 min']) expect(hint).toContain(part)
        await create()
        expect(posted('/api/tasks')).toMatchObject({
            name: 'Study', kind: 'event', due: '2026-11-19', due_time: '13:00', duration_minutes: 120,
            color: 'blue', event_type_id: 4, reminders: [15],
        })
    })

    it('a long line the rules hardly understood can be read by the AI', async () => {
        open()
        aiAnswer = { kind: 'event', name: 'Chemie lernen mit Lena', due: '2026-11-17', time: '15:00', durationMinutes: 90, color: null, eventTypeId: 4, reminders: [30], prio: null }
        type('nächste woche dienstag nachmittags mit lena für die chemie klausur lernen so 90 minuten oder so')
        const help = await screen.findByRole('button', { name: /Read with AI/ })
        expect(help).toHaveTextContent('5 left today')
        await act(async () => { fireEvent.click(help) })
        expect(posted('/api/ai/parse-entry')).toEqual({ text: 'nächste woche dienstag nachmittags mit lena für die chemie klausur lernen so 90 minuten oder so' })
        expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('Chemie lernen mit Lena')
        await create()
        expect(posted('/api/tasks')).toMatchObject({
            name: 'Chemie lernen mit Lena', kind: 'event', due: '2026-11-17', due_time: '15:00', duration_minutes: 90,
            event_type_id: 4, reminders: [30],
        })
    })

    it('when today\'s AI helps are used up it says when they come back', async () => {
        open()
        aiAnswer = Object.assign(new Error('none left'), { code: 'QUOTA_REACHED', status: 429 })
        type('nächste woche dienstag nachmittags mit lena für die chemie klausur lernen')
        await act(async () => { fireEvent.click(await screen.findByRole('button', { name: /Read with AI/ })) })
        expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('nächste woche dienstag nachmittags mit lena für die chemie klausur lernen')
        expect(screen.getByRole('status', { name: /AI/ }).textContent).toMatch(/No AI help left today/)
    })

    it('no AI button where the AI isn\'t set up, or for a short line', async () => {
        apiFetch.mockImplementation(async (url) => (url === '/api/ai/quota' ? { ...QUOTA, available: false } : {}))
        open()
        type('nächste woche dienstag nachmittags mit lena für die chemie klausur lernen')
        await act(async () => {})
        expect(screen.queryByRole('button', { name: /Read with AI/ })).toBeNull()
    })
})
