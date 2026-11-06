import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { setFocusTask } from '../features/session/sessionAction'
import { updateTaskProps } from '../features/tasks/taskAction'
import TaskRow from '../components/task/TaskRow'
import TaskChip from '../components/calendar/TaskChip'
import ReplanCard from '../components/study/ReplanCard'
import FocusTimer from '../components/focus/FocusTimer'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const BASE = '/api/tester/study'
const calls = (path, method = 'GET') => apiFetch.mock.calls.filter(([url, options]) => url === path && (options?.method ?? 'GET') === method)

const study = { goalId: 10, goalName: 'Klausur', partName: 'Thema 3', subjectName: 'Statistik II', subjectEmoji: '📊', subjectColor: 'blue' }
const sessionTask = (extra = {}) => ({
    id: 900, name: 'Thema 3', due: '2026-11-12', due_time: '17:00', duration_minutes: 45, description: '', prio: 50, done: false,
    kind: 'task', goal_part_id: 100, plan_pinned: false, study, ...extra,
})
const plainTask = { id: 5, name: 'Wäsche', due: '2026-11-12', prio: 50, done: false, kind: 'task', goal_part_id: null, plan_pinned: false, study: null }

let status
const behind = (goalId, name, behindMinutes) => ({ goalId, name, behindMinutes, conflictTaskIds: [], freedMinutes: 0 })

beforeEach(() => {
    localStorage.clear()
    status = { goals: [], notifiedMinutes: {}, aiAvailable: false }
    apiFetch.mockReset()
    apiFetch.mockImplementation(async (url, options = {}) => {
        const method = options.method ?? 'GET'
        if (url === `${BASE}/status`) return status
        if (url === `${BASE}/settings`) return { windows: [], sessionMinutes: 45, dailyMaxMinutes: 180, aiAuto: false, aiAvailable: false }
        if (url === `${BASE}/goals` && method === 'GET') return []
        if (url === `${BASE}/plan`) return { inputHash: 'a'.repeat(64), shortfall: [], goals: [] }
        if (url.endsWith('/dismiss')) return { ok: true, notifiedMinutes: {} }
        if (url.endsWith('/unpin')) return { ok: true }
        if (url === '/api/tasks') return { tasks: [], groups: [], notes: [] }
        return []
    })
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => { cleanup(); vi.useRealTimers() })

const makeStore = (isTester = true) => {
    const store = configureStore({ reducer: rootReducer, middleware: (get) => get({ serializableCheck: false, immutableCheck: false }) })
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester, adminPendingCount: 0, betaRequest: null } })
    return store
}
const wrap = (ui, store) => <Provider store={store}><MemoryRouter>{ui}</MemoryRouter></Provider>

describe('task rows of study sessions', () => {
    it('shows the marker with the subject colour under the name', () => {
        render(wrap(<ul><TaskRow task={sessionTask()} onToggleDone={() => {}} /></ul>, makeStore()))
        const marker = screen.getByText('📊 Statistik II · Thema 3')
        expect(marker).toHaveAttribute('data-task-color', 'blue')
        expect(screen.queryByText('📌')).toBeNull()
        expect(screen.queryByRole('button', { name: /Wieder dem Plan überlassen/ })).toBeNull()
    })

    it('a pinned session shows the pin and offers to give it back to the plan', async () => {
        const store = makeStore()
        render(wrap(<ul><TaskRow task={sessionTask({ plan_pinned: true })} onToggleDone={() => {}} /></ul>, store))
        expect(screen.getByRole('img', { name: /festgesetzt/i })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Wieder dem Plan überlassen/ }))
        await waitFor(() => expect(calls(`${BASE}/sessions/900/unpin`, 'POST')).toHaveLength(1))
    })

    it('an ordinary task has neither', () => {
        render(wrap(<ul><TaskRow task={plainTask} onToggleDone={() => {}} /></ul>, makeStore()))
        expect(screen.queryByText(/·/)).toBeNull()
        expect(screen.queryByRole('button', { name: /Wieder dem Plan überlassen/ })).toBeNull()
    })

    it('ticking a session off sends its own values unchanged (only done differs)', async () => {
        const store = makeStore()
        const task = sessionTask()
        apiFetch.mockResolvedValueOnce({ ...task, done: true })
        await store.dispatch(updateTaskProps({ done: true }, task))
        const body = JSON.parse(apiFetch.mock.calls[0][1].body)
        expect(body).toMatchObject({ name: 'Thema 3', due: '2026-11-12', due_time: '17:00', duration_minutes: 45, done: true })
    })
})

describe('calendar chip', () => {
    it('a study session gets a book icon', () => {
        const { container, rerender } = render(<Provider store={makeStore()}><TaskChip task={sessionTask()} onOpen={() => {}} today={new Date()} /></Provider>)
        expect(container.querySelector('[data-study-mark]')).not.toBeNull()
        rerender(<Provider store={makeStore()}><TaskChip task={plainTask} onOpen={() => {}} today={new Date()} /></Provider>)
        expect(container.querySelector('[data-study-mark]')).toBeNull()
    })
})

describe('ReplanCard', () => {
    const open = (store = makeStore()) => { render(wrap(<ReplanCard />, store)); return store }

    it('one goal behind', async () => {
        status.goals = [behind(10, 'Statistik II', 90)]
        open()
        expect(await screen.findByText('Plan anpassen? Statistik II liegt 1,5 h zurück.')).toBeInTheDocument()
    })

    it('several goals behind', async () => {
        status.goals = [behind(10, 'Statistik II', 90), behind(11, 'Mathe', 60)]
        open()
        expect(await screen.findByText('Plan anpassen? 2 Ziele liegen zurück.')).toBeInTheDocument()
    })

    it('freed time', async () => {
        status.goals = [{ goalId: 10, name: 'X', behindMinutes: 0, conflictTaskIds: [], freedMinutes: 90 }]
        open()
        expect(await screen.findByText('1,5 h frei geworden – Plan anpassen?')).toBeInTheDocument()
    })

    it('a conflict', async () => {
        status.goals = [{ goalId: 10, name: 'X', behindMinutes: 0, conflictTaskIds: [900], freedMinutes: 0 }]
        open()
        expect(await screen.findByText('Ein Termin überschneidet sich mit einer Lernsitzung – Plan anpassen?')).toBeInTheDocument()
    })

    it('a dismissed deficit below notified + session length stays hidden', async () => {
        status.goals = [behind(10, 'Statistik II', 100)]
        status.notifiedMinutes = { 10: 60 } // 100 < 60 + 45
        open()
        await waitFor(() => expect(calls(`${BASE}/settings`)).toHaveLength(1))
        await waitFor(() => expect(calls(`${BASE}/status`)).toHaveLength(1))
        await new Promise(r => setTimeout(r, 20))
        expect(screen.queryByText(/Plan anpassen/)).toBeNull()
    })

    it('Später hides it until the date changes', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2026-11-06T10:00:00'))
        status.goals = [behind(10, 'Statistik II', 90)]
        open()
        const later = await screen.findByRole('button', { name: 'Später' })
        fireEvent.click(later)
        expect(screen.queryByText(/Plan anpassen/)).toBeNull()
        expect(localStorage.getItem('studyLater')).toBe('2026-11-06')

        cleanup()
        open()
        await waitFor(() => expect(calls(`${BASE}/status`).length).toBeGreaterThan(1))
        await new Promise(r => setTimeout(r, 20))
        expect(screen.queryByText(/Plan anpassen/)).toBeNull()

        cleanup()
        vi.setSystemTime(new Date('2026-11-07T08:00:00'))
        open()
        expect(await screen.findByText(/Plan anpassen/)).toBeInTheDocument()
    })

    it('So lassen dismisses each goal that is behind', async () => {
        status.goals = [behind(10, 'Statistik II', 90), behind(11, 'Mathe', 60)]
        open()
        fireEvent.click(await screen.findByRole('button', { name: 'So lassen' }))
        await waitFor(() => expect(calls(`${BASE}/goals/10/dismiss`, 'POST')).toHaveLength(1))
        expect(calls(`${BASE}/goals/11/dismiss`, 'POST')).toHaveLength(1)
    })

    it('Ansehen opens the plan preview in place', async () => {
        status.goals = [behind(10, 'Statistik II', 90)]
        open()
        fireEvent.click(await screen.findByRole('button', { name: 'Ansehen' }))
        await waitFor(() => expect(calls(`${BASE}/goals`)).toHaveLength(1))
        await waitFor(() => expect(calls(`${BASE}/plan`)).toHaveLength(1))
    })

    it('non-testers never see it and trigger no study request', async () => {
        status.goals = [behind(10, 'Statistik II', 90)]
        open(makeStore(false))
        await new Promise(r => setTimeout(r, 20))
        expect(screen.queryByText(/Plan anpassen/)).toBeNull()
        expect(apiFetch.mock.calls.filter(([url]) => url.startsWith(BASE))).toHaveLength(0)
    })
})

describe('focus timer', () => {
    it('names subject and part of a study session', () => {
        const store = makeStore()
        store.dispatch({ type: 'SET_TASK_STATE', payload: { tasks: [sessionTask()], groups: [], notes: [] } })
        store.dispatch(setFocusTask(sessionTask()))
        render(wrap(<FocusTimer />, store))
        expect(screen.getByText('Statistik II · Thema 3')).toBeInTheDocument()
    })

    it('shows no such line for an ordinary task', () => {
        const store = makeStore()
        store.dispatch({ type: 'SET_TASK_STATE', payload: { tasks: [plainTask], groups: [], notes: [] } })
        store.dispatch(setFocusTask(plainTask))
        render(wrap(<FocusTimer />, store))
        expect(screen.queryByText(/Statistik II/)).toBeNull()
    })
})
