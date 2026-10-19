import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import togetherReducer, { idleWork } from '../features/together/togetherReducer'
import { WORK_SWITCHED, WORK_SETTLED, WORK_RESTORED, WORK_STOPPED, SHARED_SESSION_GONE } from '../features/together/togetherActionTypes'
import { startWork, stopWork, tickWork, localMs, workTotalMs, MAX_REPORT_MS } from '../features/together/work'
import { describeEvent, summaryRows } from '../features/together/format'
import toastReducer, { showToast, TOAST_MS } from '../features/toast/toast'
import { setHomeLayout } from '../features/settings/settingsAction'
import { readStoredHomeLayout } from '../features/settings/homeLayout'
import { apiFetch, fill, toCsv, formatRelative } from '../features/helperFunction'
import { translate } from '../i18n/useTranslation'
import TeamHome from '../components/TeamHome'
import TeamQuickPanel from '../components/together/TeamQuickPanel'
import Toaster from '../components/Toaster'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const ann = { id: 1, username: 'ann', displayName: 'Ann' }
const ben = { id: 2, username: 'ben', displayName: null }
const t = (key) => translate('en', key)
const makeStore = () => configureStore({ reducer: rootReducer })

const session = (id = 5, extra = {}) => ({
    id, name: `Session ${id}`, createdAt: '2026-10-18T10:00:00Z', endedAt: null, owner: ann, isOwner: true, me: 1,
    people: [{ user: ann, status: 'joined', isOwner: true, joinedAt: '', workingOn: null, totalMs: 0 }],
    tasks: [{ id: 10, name: 'Report', description: null, done: false, addedBy: ann, assignee: null, sourceTaskId: null, createdAt: '', totalMs: 5000, time: [{ userId: 1, ms: 5000 }] }],
    events: [],
    ...extra,
})
const summary = (id, extra = {}) => ({ id, name: `Session ${id}`, owner: ann, memberCount: 2, workingCount: 0, totalMs: 0, myMs: 0, endedAt: null, ...extra })

beforeEach(() => {
    apiFetch.mockReset()
    localStorage.clear()
})

describe('work reducer', () => {
    const reduce = (actions, state = togetherReducer(undefined, { type: '@@INIT' })) => actions.reduce(togetherReducer, state)
    const next = { sessionId: 5, sessionName: 'S', taskId: 10, taskName: 'Report', baseMs: 5000 }

    it('starts, books on the same task and switches', () => {
        let state = reduce([{ type: WORK_SWITCHED, payload: { next, booked: null, now: 1000 } }])
        expect(state.work).toMatchObject({ sessionId: 5, taskId: 10, since: 1000, baseMs: 5000, workedMs: 0 })

        state = reduce([{ type: WORK_SWITCHED, payload: { next: { ...next }, booked: { taskId: 10, ms: 10000 }, now: 11000 } }], state)
        expect(state.work).toMatchObject({ since: 11000, workedMs: 10000, inFlight: { 10: 10000 } })
        expect(workTotalMs(state.work, 12000)).toBe(5000 + 10000 + 1000)

        state = reduce([{ type: WORK_SETTLED, payload: { taskId: 10, ms: 10000 } }], state)
        expect(state.work.inFlight).toEqual({})

        state = reduce([{ type: WORK_SWITCHED, payload: { next: { ...next, taskId: 11, taskName: 'Slides', baseMs: 0 }, booked: { taskId: 10, ms: 2000 }, now: 13000 } }], state)
        expect(state.work).toMatchObject({ taskId: 11, taskName: 'Slides', workedMs: 0, inFlight: { 10: 2000 } })
    })

    it('a failed report counts the time again', () => {
        const state = reduce([
            { type: WORK_SWITCHED, payload: { next, booked: null, now: 0 } },
            { type: WORK_SWITCHED, payload: { next, booked: { taskId: 10, ms: 10000 }, now: 10000 } },
            { type: WORK_SETTLED, payload: { taskId: 10, ms: 10000 } },
            { type: WORK_RESTORED, payload: { taskId: 10, ms: 10000 } },
        ])
        expect(state.work.since).toBe(0)
        expect(localMs(state.work, 10, 12000)).toBe(12000)
    })

    it('stops only for the matching session, and when that session is gone', () => {
        const working = reduce([{ type: WORK_SWITCHED, payload: { next, booked: null, now: 0 } }])
        expect(reduce([{ type: WORK_STOPPED, payload: 6 }], working).work.taskId).toBe(10)
        expect(reduce([{ type: WORK_STOPPED, payload: 5 }], working).work).toEqual(idleWork)
        expect(reduce([{ type: SHARED_SESSION_GONE, payload: 5 }], working).work).toEqual(idleWork)
    })

    it('never counts more than one report can carry (computer was asleep)', () => {
        const state = reduce([{ type: WORK_SWITCHED, payload: { next, booked: null, now: 0 } }])
        expect(localMs(state.work, 10, 60 * 60 * 1000)).toBe(MAX_REPORT_MS)
    })
})

describe('work thunks', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('moving to another session finishes in the old one first', async () => {
        const store = makeStore()
        apiFetch.mockImplementation(async (url) => session(Number(url.split('/')[3])))
        await store.dispatch(startWork(session(5), session(5).tasks[0]))
        vi.advanceTimersByTime(4000)
        const other = session(6, { tasks: [{ ...session().tasks[0], id: 20, name: 'Other' }] })
        await store.dispatch(startWork(other, other.tasks[0]))
        const bodies = apiFetch.mock.calls.map(([url, options]) => [url, JSON.parse(options.body)])
        expect(bodies).toEqual([
            ['/api/shared-sessions/5/activity', { currentTaskId: 10 }],
            ['/api/shared-sessions/5/activity', { currentTaskId: null, time: { taskId: 10, ms: 4000 } }],
            ['/api/shared-sessions/6/activity', { currentTaskId: 20 }],
        ])
        expect(store.getState().together.work).toMatchObject({ sessionId: 6, taskId: 20 })
    })

    it('reports every 10 s, and stops when the session has ended', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValueOnce(session())
        await store.dispatch(startWork(session(), session().tasks[0]))
        vi.advanceTimersByTime(9000)
        await store.dispatch(tickWork())
        expect(apiFetch).toHaveBeenCalledTimes(1)

        apiFetch.mockRejectedValueOnce(Object.assign(new Error('ended'), { status: 409, code: 'SESSION_ENDED' }))
        apiFetch.mockResolvedValueOnce(session(5, { endedAt: '2026-10-18T12:00:00Z' }))
        vi.advanceTimersByTime(1000)
        await store.dispatch(tickWork())
        expect(store.getState().together.work.taskId).toBeNull()
        expect(apiFetch).toHaveBeenLastCalledWith('/api/shared-sessions/5', undefined)
    })

    it('stopWork does nothing when not working', async () => {
        const store = makeStore()
        await store.dispatch(stopWork())
        expect(apiFetch).not.toHaveBeenCalled()
    })
})

describe('toasts', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('show up and go away by themselves', () => {
        const store = makeStore()
        store.dispatch(showToast('Saved', 'success'))
        store.dispatch(showToast('Saved', 'success'))
        expect(store.getState().toast).toHaveLength(1)
        act(() => {
            render(<Provider store={store}><Toaster /></Provider>)
        })
        expect(screen.getByText('Saved')).toBeInTheDocument()
        act(() => { vi.advanceTimersByTime(TOAST_MS) })
        expect(screen.queryByText('Saved')).not.toBeInTheDocument()
    })

    it('keeps at most three', () => {
        const state = [1, 2, 3, 4].reduce((s, n) => toastReducer(s, { type: 'SHOW_TOAST', payload: { id: n, text: `t${n}` } }), [])
        expect(state.map(x => x.id)).toEqual([2, 3, 4])
    })
})

describe('home layout setting', () => {
    it('defaults to solo and is remembered', () => {
        expect(readStoredHomeLayout()).toBe('solo')
        const store = makeStore()
        store.dispatch(setHomeLayout('team'))
        expect(store.getState().settings.homeLayout).toBe('team')
        expect(readStoredHomeLayout()).toBe('team')
        store.dispatch(setHomeLayout('nonsense'))
        expect(store.getState().settings.homeLayout).toBe('team')
    })
})

describe('formatting helpers', () => {
    it('fill, toCsv, formatRelative', () => {
        expect(fill('{a} & {b}', { a: 'Ann', b: 'Ben' })).toBe('Ann & Ben')
        expect(fill('{a} {missing}', { a: 'x' })).toBe('x {missing}')
        expect(toCsv([['a', 'b,c'], ['say "hi"', 3]])).toBe('a,"b,c"\r\n"say ""hi""",3')
        const now = Date.parse('2026-10-18T12:00:00Z')
        expect(formatRelative('2026-10-18T11:59:40Z', now, 'en')).toBe('now')
        expect(formatRelative('2026-10-18T11:55:00Z', now, 'en')).toBe('5 minutes ago')
        expect(formatRelative('2026-10-18T09:00:00Z', now, 'de')).toBe('vor 3 Stunden')
    })

    it('describes feed events', () => {
        const event = (type, extra = {}) => ({ type, user: ann, target: null, taskName: 'Slides', text: null, ...extra })
        expect(describeEvent(t, event('task_added'))).toBe('Ann added "Slides"')
        expect(describeEvent(t, event('task_assigned', { target: ben }))).toBe('Ann assigned "Slides" to ben')
        expect(describeEvent(t, event('task_assigned'))).toBe('Ann unassigned "Slides"')
        expect(describeEvent(t, event('renamed', { text: 'New name' }))).toBe('Ann renamed the session to "New name"')
    })

    it('builds the CSV summary per person and task', () => {
        const s = session(5, {
            people: [
                { user: ann, status: 'joined', totalMs: 90000 },
                { user: ben, status: 'left', totalMs: 0 },
            ],
            tasks: [
                { id: 10, name: 'Report', time: [{ userId: 1, ms: 60000 }] },
                { id: 11, name: 'Slides', time: [{ userId: 1, ms: 30000 }] },
            ],
        })
        expect(summaryRows(t, s)).toEqual([
            ['Person', 'Username', 'Task', 'Time', 'Minutes'],
            ['Ann', 'ann', 'Report', '00:01:00', 1],
            ['Ann', 'ann', 'Slides', '00:00:30', 1],
            ['Ann', 'ann', 'Total', '00:01:30', 2],
        ])
    })
})

describe('Team home', () => {
    async function renderTeamHome(store = makeStore()) {
        await act(async () => {
            render(
                <Provider store={store}>
                    <MemoryRouter initialEntries={['/']}>
                        <Routes><Route path="/" element={<TeamHome />} /></Routes>
                    </MemoryRouter>
                </Provider>
            )
        })
        return store
    }

    it('without sessions, welcomes and offers to start one', async () => {
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/shared-sessions') return { sessions: [], invites: [] }
            if (url === '/api/friends') return [ben]
            throw new Error(url)
        })
        await renderTeamHome()
        expect(screen.getByRole('heading', { name: 'Gemeinsam arbeiten' })).toBeInTheDocument()
        expect(screen.getByLabelText('Name der Sitzung')).toBeInTheDocument()
    })

    it('opens the remembered session as a workspace, with tabs to switch', async () => {
        localStorage.setItem('teamSessionId', '6')
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/shared-sessions') return { sessions: [summary(5), summary(6, { workingCount: 1 })], invites: [summary(7, { invitedBy: ben })] }
            if (url === '/api/shared-sessions/6') return session(6)
            if (url === '/api/shared-sessions/5') return session(5)
            if (url === '/api/friends') return []
            throw new Error(url)
        })
        await renderTeamHome()
        expect(apiFetch).toHaveBeenCalledWith('/api/shared-sessions/6', undefined)
        expect(screen.getByRole('heading', { name: /Session 6/ })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Meine Arbeit' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Aktivität & Chat' })).toBeInTheDocument()
        // the invite waits on top
        expect(screen.getByText('lädt dich ein zu')).toBeInTheDocument()

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Session 5' })) })
        expect(screen.getByRole('heading', { name: /Session 5/ })).toBeInTheDocument()
        expect(localStorage.getItem('teamSessionId')).toBe('5')
    })
})

describe('Team quick panel', () => {
    it('counts what is waiting and lets me join from the header', async () => {
        const store = makeStore()
        store.dispatch({ type: 'SET_SHARED_SESSIONS', payload: { sessions: [summary(5, { workingCount: 2 })], invites: [summary(7, { invitedBy: ben })] } })
        store.dispatch({ type: 'SET_FRIEND_REQUESTS', payload: { incoming: [{ id: 1, user: ben, createdAt: '' }], outgoing: [] } })
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/shared-sessions') return { sessions: [summary(5, { workingCount: 2 })], invites: [summary(7, { invitedBy: ben })] }
            if (url === '/api/shared-sessions/7/join') return session(7)
            throw new Error(url)
        })
        await act(async () => {
            render(
                <Provider store={store}>
                    <MemoryRouter initialEntries={['/']}>
                        <Routes>
                            <Route path="/" element={<TeamQuickPanel />} />
                            <Route path="/together/:id" element={<p>room</p>} />
                        </Routes>
                    </MemoryRouter>
                </Provider>
            )
        })
        const button = screen.getByRole('button', { name: 'Zusammen (2)' })
        await act(async () => { fireEvent.click(button) })
        const panel = screen.getByRole('dialog')
        expect(within(panel).getByText('2 arbeiten gerade')).toBeInTheDocument()
        await act(async () => { fireEvent.click(within(panel).getByText('Beitreten')) })
        expect(apiFetch).toHaveBeenCalledWith('/api/shared-sessions/7/join', { method: 'POST', body: undefined })
        expect(screen.getByText('room')).toBeInTheDocument()
    })
})
