import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { SET_FRIENDS, SET_FRIEND_REQUESTS } from '../features/friends/friendsActionTypes'
import { selectInboxCount, setInboxUnread } from '../features/inbox/inbox'
import { projectRepeats, repeatDate } from '../features/calendar/calendar'
import { updateTaskProps } from '../features/tasks/taskAction'
import Inbox from '../components/Inbox'
import Feedback from '../components/Feedback'
import Admin from '../components/Admin'
import History from '../components/History'
import WeekDaysContainer from '../components/WeekDaysContainer'
import TaskOptionsFields from '../components/task/TaskOptionsFields'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const ben = { id: 2, username: 'ben', displayName: 'Ben' }
const cleo = { id: 3, username: 'cleo', displayName: 'Cleo' }

function makeStore(tasks = []) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks, groups: [], notes: [] } })
    store.dispatch({ type: SET_FRIENDS, payload: [ben, cleo] })
    return store
}

const renderAt = (store, path, element, route = '*') => render(
    <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
            <Routes><Route path={route} element={element} /></Routes>
        </MemoryRouter>
    </Provider>
)

// answers by url; the friends list by default, unknown ones resolve to {}
const api = (routes) => apiFetch.mockImplementation(async (url, options = {}) => {
    const handler = { 'GET /api/friends': [ben, cleo], ...routes }[`${options.method ?? 'GET'} ${url}`];
    return typeof handler === 'function' ? handler(options) : handler ?? {};
})

beforeEach(() => { apiFetch.mockReset(); localStorage.clear() })

describe('inbox', () => {
    it('counts unread messages, notices and open requests for the menu', () => {
        const store = makeStore()
        store.dispatch(setInboxUnread({ messages: 2, notifications: 1 }))
        store.dispatch({ type: SET_FRIEND_REQUESTS, payload: { incoming: [{ id: 7, user: cleo, createdAt: '2026-10-01' }], outgoing: [] } })
        expect(selectInboxCount(store.getState())).toBe(4)
    })

    it('lists conversations and writes to a friend', async () => {
        api({
            'GET /api/inbox/unread': { messages: 1, notifications: 0 },
            'GET /api/messages': [{ user: ben, lastMessage: { id: 1, body: 'Kommst du morgen?', fromMe: false, createdAt: new Date().toISOString() }, unread: 1 }],
            'GET /api/messages/2': { user: ben, canWrite: true, messages: [{ id: 1, body: 'Kommst du morgen?', fromMe: false, createdAt: new Date().toISOString() }] },
            'POST /api/messages/2': (options) => ({ id: 2, body: JSON.parse(options.body).body, fromMe: true, createdAt: new Date().toISOString() }),
        })
        await act(async () => { renderAt(makeStore(), '/inbox', <Inbox />) })

        expect(screen.getByText('Kommst du morgen?')).toBeInTheDocument()
        // Cleo has no conversation yet: offered to start one
        expect(screen.getByRole('button', { name: /Cleo/ })).toBeInTheDocument()

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ben/ })) })
        fireEvent.change(screen.getByLabelText('Nachricht schreiben…'), { target: { value: 'Ja, um 10!' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Senden' })) })

        expect(apiFetch).toHaveBeenCalledWith('/api/messages/2', expect.objectContaining({ method: 'POST', body: JSON.stringify({ body: 'Ja, um 10!' }) }))
        expect(screen.getByText('Ja, um 10!')).toBeInTheDocument()
    })

    it('shows notices and marks them read', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        api({
            'GET /api/notifications': [{ id: 4, kind: 'broadcast', title: 'Neue Version', body: 'Jetzt mit Wiederholungen.', createdAt: new Date().toISOString(), readAt: null }],
        })
        await act(async () => { renderAt(makeStore(), '/inbox?tab=notices', <Inbox />) })
        expect(screen.getByText('Neue Version')).toBeInTheDocument()
        expect(screen.getByText('Jetzt mit Wiederholungen.')).toBeInTheDocument()
        await act(async () => { vi.advanceTimersByTime(2000) })
        expect(apiFetch).toHaveBeenCalledWith('/api/notifications/read', expect.objectContaining({ method: 'POST' }))
        vi.useRealTimers()
    })

    it('answers a friend request from the requests tab', async () => {
        const store = makeStore()
        store.dispatch({ type: SET_FRIEND_REQUESTS, payload: { incoming: [{ id: 7, user: cleo, createdAt: '2026-10-01' }], outgoing: [] } })
        api({ 'POST /api/friends/requests/7/accept': { friend: cleo } })
        await act(async () => { renderAt(store, '/inbox?tab=requests', <Inbox />) })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Annehmen' })) })
        expect(apiFetch).toHaveBeenCalledWith('/api/friends/requests/7/accept', expect.objectContaining({ method: 'POST' }))
        expect(store.getState().friends.incoming).toHaveLength(0)
    })

    it('lists due and coming reminders from the tasks', async () => {
        const soon = new Date(Date.now() + 2 * 60 * 60 * 1000)
        const day = soon.toISOString().slice(0, 10)
        const time = `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}`
        const tasks = [{ id: 1, name: 'Zahnarzt', done: false, due: day, due_time: time, reminder_minutes: 30, prio: 50 }]
        api({})
        await act(async () => { renderAt(makeStore(tasks), '/inbox?tab=reminders', <Inbox />) })
        expect(screen.getByText('Kommende 7 Tage')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Zahnarzt' })).toBeInTheDocument()
    })
})

describe('feedback page', () => {
    it('sends feedback with its category', async () => {
        api({ 'POST /api/feedback': { sent: true } })
        await act(async () => { renderAt(makeStore(), '/feedback', <Feedback />) })
        fireEvent.click(screen.getByRole('radio', { name: 'Fehler' }))
        fireEvent.change(screen.getByLabelText(/Was ist passiert/), { target: { value: 'Der Kalender springt.' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Feedback senden' })) })
        expect(apiFetch).toHaveBeenCalledWith('/api/feedback', expect.objectContaining({
            method: 'POST', body: JSON.stringify({ category: 'bug', message: 'Der Kalender springt.' }),
        }))
        expect(screen.getByText(/Dein Feedback ist angekommen/)).toBeInTheDocument()
    })
})

describe('admin broadcast', () => {
    it('asks once more, then sends to everybody', async () => {
        api({
            'GET /api/admin/broadcasts': [],
            'POST /api/admin/broadcasts': { id: 1, recipientCount: 12, createdAt: new Date().toISOString() },
        })
        await act(async () => { renderAt(makeStore(), '/admin?tab=broadcast', <Admin />) })
        fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Wartung' } })
        fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Heute Abend kurz offline.' } })
        fireEvent.click(screen.getByRole('button', { name: 'An alle senden…' }))
        expect(apiFetch).not.toHaveBeenCalledWith('/api/admin/broadcasts', expect.anything())
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ja, senden' })) })
        expect(apiFetch).toHaveBeenCalledWith('/api/admin/broadcasts', expect.objectContaining({
            method: 'POST', body: JSON.stringify({ title: 'Wartung', body: 'Heute Abend kurz offline.', audience: 'all' }),
        }))
        expect(within(screen.getAllByRole('list').at(-1)).getByText('Wartung')).toBeInTheDocument()
    })

    it('can go to the testers only', async () => {
        api({
            'GET /api/admin/broadcasts': [],
            'POST /api/admin/broadcasts': { id: 2, audience: 'testers', recipientCount: 3, createdAt: new Date().toISOString() },
        })
        await act(async () => { renderAt(makeStore(), '/admin?tab=broadcast', <Admin />) })
        fireEvent.click(screen.getByRole('button', { name: 'Nur Tester' }))
        expect(screen.getByRole('button', { name: 'Nur Tester' })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Neu: Statistik' } })
        fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Bitte ausprobieren.' } })
        fireEvent.click(screen.getByRole('button', { name: 'An Tester senden…' }))
        expect(screen.getByText(/Wirklich an alle Tester senden/)).toBeInTheDocument()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ja, senden' })) })
        expect(apiFetch).toHaveBeenCalledWith('/api/admin/broadcasts', expect.objectContaining({
            method: 'POST', body: JSON.stringify({ title: 'Neu: Statistik', body: 'Bitte ausprobieren.', audience: 'testers' }),
        }))
        expect(within(screen.getAllByRole('list').at(-1)).getByText('Nur Tester')).toBeInTheDocument()
    })
})

describe('completed tasks in the history', () => {
    it('lists done tasks by the day they were completed', async () => {
        const tasks = [
            { id: 1, name: 'Steuer', done: true, completed_at: '2026-10-18T09:30:00Z', due: '2026-10-17', prio: 50 },
            { id: 2, name: 'Altes Ding', done: true, completed_at: null, due: null, prio: 50 },
            { id: 3, name: 'Offen', done: false, due: null, prio: 50 },
        ]
        api({ 'GET /api/shared-sessions/history': [] })
        await act(async () => { renderAt(makeStore(tasks), '/history?tab=done', <History />) })
        expect(screen.getByRole('tab', { name: /Erledigte Aufgaben/ })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByText('Steuer')).toBeInTheDocument()
        expect(screen.getByText(/Früher erledigt/)).toBeInTheDocument()
        expect(screen.queryByText('Offen')).not.toBeInTheDocument()
    })
})

describe('repeating tasks', () => {
    it('steps from the day itself, so the 31st stays the 31st where it can', () => {
        const start = new Date(2026, 0, 31)
        expect(repeatDate(start, 'monthly', 1).getDate()).toBe(28)
        expect(repeatDate(start, 'monthly', 2).getDate()).toBe(31)
        expect(repeatDate(start, 'weekly', 1).getDate()).toBe(7)
        expect(repeatDate(new Date(2024, 1, 29), 'yearly', 1).getDate()).toBe(28)
    })

    it('previews coming repeats of open tasks only', () => {
        const tasks = [
            { id: 1, name: 'Sport', done: false, due: '2026-10-20', repeat: 'weekly' },
            { id: 2, name: 'Erledigt', done: true, due: '2026-10-20', repeat: 'daily' },
            { id: 3, name: 'Einmal', done: false, due: '2026-10-20', repeat: null },
        ]
        const previews = projectRepeats(tasks, new Date(2026, 10, 10))
        expect(previews.map(p => p.due)).toEqual(['2026-10-27', '2026-11-03', '2026-11-10'])
        expect(previews.every(p => p.projected && p.repeatOf.id === 1)).toBe(true)
    })

    it('adds the next one the server made when a repeating task is done', async () => {
        const task = { id: 1, name: 'Sport', done: false, due: '2026-10-20', repeat: 'weekly', prio: 50 }
        const store = makeStore([task])
        apiFetch.mockResolvedValueOnce({ ...task, done: true, completed_at: '2026-10-20T10:00:00Z', nextTask: { ...task, id: 2, due: '2026-10-27' } })
        await store.dispatch(updateTaskProps({ done: true }, task))
        const tasks = store.getState().task.tasks
        expect(tasks.find(t => t.id === 1)).toMatchObject({ done: true, completed_at: '2026-10-20T10:00:00Z' })
        expect(tasks.find(t => t.id === 2)).toMatchObject({ done: false, due: '2026-10-27' })
        expect(JSON.parse(apiFetch.mock.calls[0][1].body).repeat).toBe('weekly')
    })

    it('offers repeating in the options, only with a date', () => {
        const onChange = vi.fn()
        const { rerender } = render(<Provider store={makeStore()}><TaskOptionsFields value={{}} hasTime={false} hasDate onChange={onChange} /></Provider>)
        fireEvent.change(screen.getByLabelText('Wiederholen'), { target: { value: 'monthly' } })
        expect(onChange).toHaveBeenCalledWith({ repeat: 'monthly' })
        rerender(<Provider store={makeStore()}><TaskOptionsFields value={{}} hasTime={false} hasDate={false} onChange={onChange} /></Provider>)
        expect(screen.getByLabelText('Wiederholen')).toBeDisabled()
    })
})

describe('week strip', () => {
    it('shows the name before the time', async () => {
        const today = new Date()
        const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        const tasks = [{ id: 1, name: 'Meeting', done: false, due: key, due_time: '09:30', prio: 50 }]
        await act(async () => { renderAt(makeStore(tasks), '/', <WeekDaysContainer t={(k) => k} tasks={tasks} />) })
        const item = screen.getByTitle('Meeting 09:30')
        expect(item.textContent).toBe('Meeting09:30')
    })
})
