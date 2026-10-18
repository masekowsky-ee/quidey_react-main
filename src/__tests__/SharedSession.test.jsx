import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import SharedSession from '../components/SharedSession'
import Together from '../components/Together'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const ann = { id: 1, username: 'ann', displayName: 'Ann' }
const ben = { id: 2, username: 'ben', displayName: 'Ben' }

// Session 5 as ann sees it: ben is working on "Slides" right now
const baseSession = () => ({
    id: 5, name: 'Study group', createdAt: '2026-10-18T10:00:00Z', endedAt: null,
    owner: ann, isOwner: true, me: 1,
    people: [
        { user: ann, status: 'joined', isOwner: true, joinedAt: '2026-10-18T10:00:00Z', workingOn: null, totalMs: 60000 },
        { user: ben, status: 'joined', isOwner: false, joinedAt: '2026-10-18T10:01:00Z', workingOn: 11, totalMs: 120000 },
    ],
    tasks: [
        { id: 10, name: 'Report', description: null, done: false, addedBy: ann, sourceTaskId: null, createdAt: '', totalMs: 60000, time: [{ userId: 1, ms: 60000 }] },
        { id: 11, name: 'Slides', description: 'for friday', done: false, addedBy: ben, sourceTaskId: null, createdAt: '', totalMs: 120000, time: [{ userId: 2, ms: 120000 }] },
    ],
})

let current
let activity

function mockApi() {
    current = baseSession()
    activity = []
    apiFetch.mockImplementation(async (url, options = {}) => {
        if (url === '/api/friends') return [ann, ben]
        // copies, like JSON from a real server: the store must never share objects with the mock
        if (url === '/api/shared-sessions/5' && !options.method) return structuredClone(current)
        if (url === '/api/shared-sessions/5/activity') {
            const body = JSON.parse(options.body)
            activity.push(body)
            if (body.time) {
                const task = current.tasks.find(t => t.id === body.time.taskId)
                task.totalMs += body.time.ms
                const mine = task.time.find(t => t.userId === 1)
                if (mine) mine.ms += body.time.ms
                else task.time.push({ userId: 1, ms: body.time.ms })
                current.people[0].totalMs += body.time.ms
            }
            return structuredClone(current)
        }
        if (url === '/api/shared-sessions' && !options.method) return { sessions: [], invites: [] }
        throw new Error(`unexpected call ${options.method ?? 'GET'} ${url}`)
    })
}

async function renderSession() {
    const store = configureStore({ reducer: rootReducer })
    await act(async () => {
        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={['/together/5']}>
                    <Routes>
                        <Route path="/together/:id" element={<SharedSession />} />
                        <Route path="/together" element={<Together />} />
                    </Routes>
                </MemoryRouter>
            </Provider>
        )
    })
    return store
}

const taskRow = (name) => screen.getAllByText(name).map(el => el.closest('li')).find(li => li?.querySelector('input[type=checkbox]'))

describe('Shared session page', () => {
    beforeEach(() => {
        apiFetch.mockReset()
        vi.useFakeTimers({ shouldAdvanceTime: false })
        mockApi()
    })
    afterEach(() => { vi.useRealTimers() })

    it('shows tasks, who is working on what, and who worked how long', async () => {
        await renderSession()
        expect(screen.getByRole('heading', { name: 'Study group' })).toBeInTheDocument()
        // ben works on Slides right now: shown in the members list
        const members = screen.getByRole('heading', { name: 'Mitglieder' }).closest('section')
        expect(within(within(members).getByText('Ben').closest('li')).getByText('Slides')).toBeInTheDocument()
        // summary: ben 2 min on Slides, ann 1 min on Report
        const summary = screen.getByText('Wer hat woran gearbeitet').closest('section')
        expect(within(summary).getByText('2 min', { selector: '[class*=timeMain]' })).toBeInTheDocument()
        expect(within(summary).getByText('Report')).toBeInTheDocument()
        // 3 minutes together
        expect(screen.getByText('3 min')).toBeInTheDocument()
    })

    it('tracks my time on a task and books it on the server', async () => {
        await renderSession()
        await act(async () => { fireEvent.click(within(taskRow('Report')).getByText('Daran arbeiten')) })
        expect(activity.at(-1)).toEqual({ currentTaskId: 10 })
        expect(screen.getByText('Du arbeitest gerade daran')).toBeInTheDocument()

        // after 10 s the time goes to the server
        await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
        expect(activity.at(-1)).toEqual({ currentTaskId: 10, time: { taskId: 10, ms: 10000 } })
        expect(screen.getByText('00:01:10')).toBeInTheDocument()

        // switching books the rest on the old task, pause books on the new one
        await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
        await act(async () => { fireEvent.click(within(taskRow('Slides')).getByText('Daran arbeiten')) })
        expect(activity.at(-1)).toEqual({ currentTaskId: 11, time: { taskId: 10, ms: 3000 } })
        await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
        await act(async () => { fireEvent.click(within(taskRow('Slides')).getByText('Pause')) })
        expect(activity.at(-1)).toEqual({ currentTaskId: null, time: { taskId: 11, ms: 2000 } })
        expect(current.tasks[1].time.find(t => t.userId === 1).ms).toBe(2000)
    })

    it('books the last seconds when leaving the page', async () => {
        await renderSession()
        await act(async () => { fireEvent.click(within(taskRow('Report')).getByText('Daran arbeiten')) })
        await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
        await act(async () => { fireEvent.click(screen.getByText(/← Zusammen/)) })
        const last = apiFetch.mock.calls.filter(([url]) => url.endsWith('/activity')).at(-1)
        expect(JSON.parse(last[1].body)).toEqual({ currentTaskId: null, time: { taskId: 10, ms: 4000 } })
        expect(last[1].keepalive).toBe(true)
    })

    it('shows a message when the session is not available', async () => {
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/friends') return []
            throw Object.assign(new Error('nope'), { status: 404, code: 'SESSION_NOT_FOUND' })
        })
        await renderSession()
        expect(screen.getByText(/Diese Sitzung gibt es nicht/)).toBeInTheDocument()
    })
})
