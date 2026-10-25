import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { useWorkReporter } from '../features/together/work'
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
        { id: 10, name: 'Report', description: null, done: false, addedBy: ann, assignee: null, sourceTaskId: null, createdAt: '', totalMs: 60000, time: [{ userId: 1, ms: 60000 }] },
        { id: 11, name: 'Slides', description: 'for friday', done: false, addedBy: ben, assignee: ben, sourceTaskId: null, createdAt: '', totalMs: 120000, time: [{ userId: 2, ms: 120000 }] },
    ],
    events: [
        { id: 1, type: 'created', user: ann, target: null, taskId: null, taskName: null, text: 'Study group', createdAt: '2026-10-18T10:00:00Z' },
        { id: 2, type: 'started', user: ben, target: null, taskId: 11, taskName: 'Slides', text: null, createdAt: '2026-10-18T10:02:00Z' },
    ],
})

let current
let calls

// Answers like the backend: copies (like JSON), so the store never shares objects with the mock
function mockApi() {
    current = baseSession()
    calls = []
    apiFetch.mockImplementation(async (url, options = {}) => {
        const body = options.body ? JSON.parse(options.body) : undefined
        calls.push({ url, method: options.method ?? 'GET', body, keepalive: options.keepalive })
        if (url === '/api/friends') return [ann, ben]
        if (url === '/api/shared-sessions' && !options.method) return { sessions: [], invites: [] }
        if (url === '/api/shared-sessions/5' && !options.method) return structuredClone(current)
        if (url === '/api/shared-sessions/5/activity') {
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
        if (url === '/api/shared-sessions/5/messages') {
            current.events.push({ id: 99, type: 'message', user: ann, target: null, taskId: null, taskName: null, text: body.text, createdAt: new Date().toISOString() })
            return structuredClone(current)
        }
        if (url.startsWith('/api/shared-sessions/5/tasks/') && options.method === 'PATCH') {
            const task = current.tasks.find(t => t.id === Number(url.split('/').pop()))
            const { assigneeId, ...fields } = body
            if ('assigneeId' in body) task.assignee = [ann, ben].find(u => u.id === assigneeId) ?? null
            Object.assign(task, fields)
            return structuredClone(current)
        }
        throw new Error(`unexpected call ${options.method ?? 'GET'} ${url}`)
    })
}

const activity = () => calls.filter(c => c.url.endsWith('/activity'))

// like App: the reporter that sends the stopwatch's reports runs outside the page
function Harness() {
    useWorkReporter()
    return (
        <Routes>
            <Route path="/together/:id" element={<SharedSession />} />
            <Route path="/together" element={<Together />} />
        </Routes>
    )
}

async function renderSession() {
    const store = configureStore({ reducer: rootReducer })
    await act(async () => {
        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={['/together/5']}><Harness /></MemoryRouter>
            </Provider>
        )
    })
    return store
}

const card = (title) => screen.getByRole('heading', { name: title }).closest('section')
const taskRow = (name) => within(card('Gemeinsame Aufgaben')).getAllByText(name).map(el => el.closest('li')).find(li => li?.querySelector('input[type=checkbox]'))

describe('Shared session page', () => {
    beforeEach(() => {
        apiFetch.mockReset()
        vi.useFakeTimers({ shouldAdvanceTime: false })
        mockApi()
    })
    afterEach(() => { vi.useRealTimers() })

    it('shows tasks, who is working on what, the feed, and who worked how long', async () => {
        await renderSession()
        expect(screen.getByRole('heading', { name: /Study group/ })).toBeInTheDocument()
        // ben works on Slides right now
        expect(within(card('Team')).getByText('an Slides')).toBeInTheDocument()
        // assignment shown on the task
        expect(within(taskRow('Slides')).getByRole('combobox')).toHaveValue('2')
        // the feed says it in words
        expect(within(card('Aktivität & Chat')).getByText('Ben arbeitet an „Slides“')).toBeInTheDocument()
        // summary: ben 2 min, ann 1 min
        const summary = card('Wer hat woran gearbeitet')
        expect(within(summary).getByText('2 min', { selector: '[class*=timeMain]' })).toBeInTheDocument()
        expect(within(summary).getByText('67%')).toBeInTheDocument()
    })

    it('tracks my time on a task and books it on the server', async () => {
        await renderSession()
        await act(async () => { fireEvent.click(within(taskRow('Report')).getByText('Daran arbeiten')) })
        expect(activity().at(-1).body).toEqual({ currentTaskId: 10 })
        expect(screen.getByText('Du arbeitest gerade daran')).toBeInTheDocument()

        // after 30 s the time goes to the server; the clock doesn't count it twice
        await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
        expect(activity().at(-1).body).toEqual({ currentTaskId: 10, time: { taskId: 10, ms: 30000 } })
        expect(within(card('Meine Arbeit')).getByText('00:01:30')).toBeInTheDocument()

        // switching books the rest on the old task, pause books on the new one
        await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
        await act(async () => { fireEvent.click(within(taskRow('Slides')).getByText('Daran arbeiten')) })
        expect(activity().at(-1).body).toEqual({ currentTaskId: 11, time: { taskId: 10, ms: 3000 } })
        await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
        await act(async () => { fireEvent.click(within(taskRow('Slides')).getByText('Pause')) })
        expect(activity().at(-1).body).toEqual({ currentTaskId: null, time: { taskId: 11, ms: 2000 } })
        expect(current.tasks[1].time.find(t => t.userId === 1).ms).toBe(2000)
    })

    it('keeps working on other pages, and books the last seconds when the tab closes', async () => {
        const store = await renderSession()
        await act(async () => { fireEvent.click(within(taskRow('Report')).getByText('Daran arbeiten')) })
        await act(async () => { fireEvent.click(screen.getByText(/← Sitzungen/)) })
        expect(activity().at(-1).body).toEqual({ currentTaskId: 10 })
        expect(store.getState().together.work.taskId).toBe(10)

        await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
        await act(async () => { window.dispatchEvent(new Event('pagehide')) })
        expect(activity().at(-1)).toMatchObject({ body: { currentTaskId: null, time: { taskId: 10, ms: 4000 } }, keepalive: true })
        expect(store.getState().together.work.taskId).toBeNull()
    })

    it('sends chat messages', async () => {
        await renderSession()
        const input = screen.getByPlaceholderText('Nachricht an das Team…')
        fireEvent.change(input, { target: { value: 'Hallo zusammen' } })
        await act(async () => { fireEvent.submit(input.closest('form')) })
        expect(calls.at(-1)).toMatchObject({ url: '/api/shared-sessions/5/messages', method: 'POST', body: { text: 'Hallo zusammen' } })
        expect(screen.getByText('Hallo zusammen')).toBeInTheDocument()
        expect(input).toHaveValue('')
    })

    it('assigns a task', async () => {
        await renderSession()
        await act(async () => { fireEvent.change(within(taskRow('Report')).getByRole('combobox'), { target: { value: '2' } }) })
        expect(calls.at(-1)).toMatchObject({ url: '/api/shared-sessions/5/tasks/10', method: 'PATCH', body: { assigneeId: 2 } })
        // "assigned to me" filter: ben has both now, ann (me) none
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Für mich/ })) })
        expect(screen.getByText('Keine offenen Aufgaben in diesem Filter.')).toBeInTheDocument()
    })

    it("edits a task's details; the day and everything else is optional, personal options are left out", async () => {
        await renderSession()
        await act(async () => { fireEvent.click(within(taskRow('Report')).getByRole('button', { name: 'Bearbeiten: Report' })) })
        const dialog = screen.getByRole('dialog')
        // no day is fine for a session task
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' })) })
        expect(calls.at(-1)).toMatchObject({
            url: '/api/shared-sessions/5/tasks/10', method: 'PATCH',
            body: { name: 'Report', due: null, due_time: null, description: '', location: '', link: '', details: '' },
        })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        await act(async () => { fireEvent.click(within(taskRow('Report')).getByRole('button', { name: 'Bearbeiten: Report' })) })
        const again = screen.getByRole('dialog')
        fireEvent.change(within(again).getByLabelText('Fälligkeitsdatum'), { target: { value: '2026-10-25' } })
        fireEvent.click(within(again).getByRole('button', { name: /Weitere Optionen/ }))
        // reminders, repeating, sharing and groups belong to one's own tasks
        expect(within(again).queryByLabelText('Wiederholen')).not.toBeInTheDocument()
        expect(within(again).queryByLabelText('Erinnerung')).not.toBeInTheDocument()
        expect(within(again).queryByRole('button', { name: 'Zu Gruppe hinzufügen' })).not.toBeInTheDocument()
        fireEvent.change(within(again).getByLabelText('Ort'), { target: { value: 'Bib' } })
        await act(async () => { fireEvent.click(within(again).getByRole('button', { name: 'Speichern' })) })
        expect(calls.at(-1).body).toMatchObject({ due: '2026-10-25', location: 'Bib' })
        expect(calls.at(-1).body).not.toHaveProperty('repeat')
        expect(calls.at(-1).body).not.toHaveProperty('reminder_minutes')
        expect(within(taskRow('Report')).getByText('Bib')).toBeInTheDocument()
    })

    it('still works with a backend that sends no feed or assignments yet', async () => {
        delete current.events
        current.tasks.forEach(task => { delete task.assignee })
        await renderSession()
        expect(within(card('Aktivität & Chat')).getByText('Noch nichts passiert.')).toBeInTheDocument()
        expect(within(taskRow('Slides')).getByRole('combobox')).toHaveValue('')
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
