import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_FRIENDS } from '../features/friends/friendsActionTypes'
import { SET_SHARED_SESSION, SHARED_SESSION_EVENT } from '../features/together/togetherActionTypes'
import { connectRealtime, disconnectRealtime, useRealtimeSession, REALTIME_RECONNECT } from '../features/realtime/socket'
import { useInboxRealtime } from '../features/inbox/useInboxRealtime'
import Inbox from '../components/Inbox'
import Toaster from '../components/Toaster'
import Header from '../components/Header'
import { useLocation } from 'react-router-dom'
import { fireEvent } from '@testing-library/react'
import { setInboxUnread, selectMenuBadgeCount } from '../features/inbox/inbox'
import { io } from 'socket.io-client'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

// A stand-in for the Socket.IO connection: tests push server events with serverSends()
const fake = vi.hoisted(() => ({ socket: null }))
vi.mock('socket.io-client', () => ({
    io: vi.fn(() => {
        const handlers = {}
        let any = null
        fake.socket = {
            connected: true,
            emit: vi.fn(),
            on: (event, handler) => { handlers[event] = handler },
            onAny: (handler) => { any = handler },
            connect: vi.fn(),
            disconnect: vi.fn(),
            fire: (event, payload) => (handlers[event] ? handlers[event](payload) : any?.(event, payload)),
        }
        return fake.socket
    }),
}))

const serverSends = (event, payload) => act(async () => { fake.socket.fire(event, payload) })

const ben = { id: 2, username: 'ben', displayName: 'Ben' }
const now = () => new Date().toISOString()

function makeStore() {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_FRIENDS, payload: [ben] })
    return store
}

const api = (routes) => apiFetch.mockImplementation(async (url, options = {}) => {
    const handler = { 'GET /api/friends': [ben], 'GET /api/inbox/unread': { messages: 0, notifications: 0 }, ...routes }[`${options.method ?? 'GET'} ${url}`]
    return typeof handler === 'function' ? handler(options) : handler ?? {}
})

function Live({ children }) {
    useInboxRealtime()
    return children
}

const renderAt = (store, path, element) => render(
    <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
            <Routes><Route path="*" element={<Live>{element}</Live>} /></Routes>
        </MemoryRouter>
    </Provider>
)

beforeEach(async () => {
    apiFetch.mockReset()
    localStorage.clear()
    localStorage.setItem('token', 'abc')
    await connectRealtime()
})
afterEach(() => disconnectRealtime())

describe('live chats and notices', () => {
    it('signs the connection in with the stored token', () => {
        const auth = vi.fn()
        // the auth option is read on every (re)connect
        vi.mocked(io).mock.calls.at(-1)[1].auth(auth)
        expect(auth).toHaveBeenCalledWith({ token: 'abc' })
    })

    it('shows a message in the open conversation right away and marks it read', async () => {
        api({
            'GET /api/messages/2': { user: ben, canWrite: true, messages: [{ id: 1, body: 'Hallo', fromMe: false, createdAt: now() }] },
            'POST /api/messages/2': () => ({ id: 2, body: 'Hi Ben', fromMe: true, createdAt: now() }),
        })
        await act(async () => { renderAt(makeStore(), '/inbox?with=2', <Inbox />) })
        expect(screen.getByText('Hallo')).toBeInTheDocument()

        await serverSends('message:new', { user: ben, message: { id: 3, body: 'Bist du da?', fromMe: false, createdAt: now() } })
        expect(screen.getByText('Bist du da?')).toBeInTheDocument()
        expect(apiFetch).toHaveBeenCalledWith('/api/messages/2/read', { method: 'POST' })
        // no toast for the conversation I'm reading
        expect(screen.queryByText('Neue Nachricht von Ben')).not.toBeInTheDocument()

        // the same message twice (my other tab, or the answer to sending) is shown once
        await serverSends('message:new', { user: ben, message: { id: 3, body: 'Bist du da?', fromMe: false, createdAt: now() } })
        expect(screen.getAllByText('Bist du da?')).toHaveLength(1)
    })

    it('ignores messages from other conversations in the open one', async () => {
        api({ 'GET /api/messages/2': { user: ben, canWrite: true, messages: [] } })
        await act(async () => { renderAt(makeStore(), '/inbox?with=2', <Inbox />) })
        await serverSends('message:new', { user: { id: 9, username: 'zoe', displayName: 'Zoe' }, message: { id: 5, body: 'Von Zoe', fromMe: false, createdAt: now() } })
        expect(screen.queryByText('Von Zoe', { selector: 'span' })).not.toBeInTheDocument()
    })

    it('puts a new notice from the team on top of the list', async () => {
        api({ 'GET /api/notifications': [{ id: 1, kind: 'broadcast', title: 'Alt', body: 'Alte Meldung', createdAt: now(), readAt: now() }] })
        await act(async () => { renderAt(makeStore(), '/inbox?tab=notices', <Inbox />) })

        await serverSends('notification:new', { id: 2, kind: 'broadcast', title: 'Wartung', body: 'Heute Abend kurz offline', createdAt: now(), readAt: null })
        const titles = screen.getAllByText(/Wartung|Alt/, { selector: 'span' }).map(el => el.textContent)
        expect(titles).toEqual(['Wartung', 'Alt'])
    })

    it('tells me about new messages and notices elsewhere in the app', async () => {
        api({ 'GET /api/inbox/unread': { messages: 1, notifications: 1 } })
        const store = makeStore()
        await act(async () => { renderAt(store, '/calendar', <p>Kalender</p>) })
        await serverSends('message:new', { user: ben, message: { id: 3, body: 'Hey', fromMe: false, createdAt: now() } })
        await serverSends('notification:new', { id: 4, kind: 'broadcast', title: 'Neu: Kalender', body: '…', createdAt: now(), readAt: null })
        // my own message from another tab is no news
        await serverSends('message:new', { user: ben, message: { id: 5, body: 'Ok', fromMe: true, createdAt: now() } })

        expect(store.getState().toast.map(toast => toast.text)).toEqual(['Neue Nachricht von Ben', 'Neue Meldung: Neu: Kalender'])
        expect(store.getState().inbox).toEqual({ messages: 1, notifications: 1 })
    })

    it('opens the conversation when the popup is clicked', async () => {
        api({ 'GET /api/messages/2': { user: ben, canWrite: true, messages: [] } })
        function Where() { return <p data-testid="where">{useLocation().pathname + useLocation().search}</p> }
        await act(async () => { renderAt(makeStore(), '/calendar', <><Where /><Toaster /></>) })
        await serverSends('message:new', { user: ben, message: { id: 3, body: 'Lernen wir heute?', fromMe: false, createdAt: now() } })

        expect(screen.getByText('Lernen wir heute?')).toBeInTheDocument()
        fireEvent.click(screen.getByText('Neue Nachricht von Ben'))
        expect(screen.getByTestId('where')).toHaveTextContent('/inbox?with=2')
    })

    it('closes a popup with its cross without opening anything', async () => {
        function Where() { return <p data-testid="where">{useLocation().pathname + useLocation().search}</p> }
        const store = makeStore()
        await act(async () => { renderAt(store, '/calendar', <><Where /><Toaster /></>) })
        await serverSends('message:new', { user: ben, message: { id: 3, body: 'Hi', fromMe: false, createdAt: now() } })
        fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
        expect(store.getState().toast).toEqual([])
        expect(screen.getByTestId('where')).toHaveTextContent('/calendar')
    })

    it('opens the notices when a notice popup is clicked', async () => {
        function Where() { return <p data-testid="where">{useLocation().pathname + useLocation().search}</p> }
        await act(async () => { renderAt(makeStore(), '/', <><Where /><Toaster /></>) })
        await serverSends('notification:new', { id: 4, kind: 'broadcast', title: 'Wartung', body: 'Heute Abend', createdAt: now(), readAt: null })
        fireEvent.click(screen.getByText('Neue Meldung: Wartung'))
        expect(screen.getByTestId('where')).toHaveTextContent('/inbox?tab=notices')
    })

    it('tells me when somebody gives me a task in a session, and opens the session', async () => {
        function Where() { return <p data-testid="where">{useLocation().pathname}</p> }
        await act(async () => { renderAt(makeStore(), '/', <><Where /><Toaster /></>) })
        await serverSends('notification:new', {
            id: 6, kind: 'task_assigned', title: 'Folien', body: 'Lerngruppe', createdAt: now(), readAt: null,
            data: { sessionId: 3, taskId: 7, by: ben },
        })
        expect(screen.getByText('In der Session „Lerngruppe“')).toBeInTheDocument()
        fireEvent.click(screen.getByText('Ben hat dir „Folien“ zugewiesen'))
        expect(screen.getByTestId('where')).toHaveTextContent('/together/3')
    })

    it('lists a given task among the notices, linked to its session', async () => {
        api({ 'GET /api/notifications': [{ id: 6, kind: 'task_assigned', title: 'Folien', body: 'Lerngruppe', createdAt: now(), readAt: now(), data: { sessionId: 3, taskId: 7, by: ben } }] })
        await act(async () => { renderAt(makeStore(), '/inbox?tab=notices', <Inbox />) })
        expect(screen.getByRole('link', { name: 'Ben hat dir „Folien“ zugewiesen' })).toHaveAttribute('href', '/together/3')
    })

    it('shows unread things on the menu button', async () => {
        const store = makeStore()
        store.dispatch({ type: 'LOGIN_SUCCESS', payload: { token: 'abc', username: 'me' } })
        await act(async () => { renderAt(store, '/', <Header />) })
        expect(screen.getByRole('button', { name: 'Menü' })).toBeInTheDocument()

        await act(async () => { store.dispatch(setInboxUnread({ messages: 2, notifications: 1 })) })
        expect(selectMenuBadgeCount(store.getState())).toBe(3)
        expect(screen.getByRole('button', { name: 'Menü, 3 neu' })).toHaveTextContent('3')
    })

    it('loads the conversation again after the connection came back', async () => {
        let calls = 0
        api({ 'GET /api/messages/2': () => { calls += 1; return { user: ben, canWrite: true, messages: [] } } })
        await act(async () => { renderAt(makeStore(), '/inbox?with=2', <Inbox />) })
        expect(calls).toBe(1)
        await serverSends(REALTIME_RECONNECT)
        // the fake socket passes it straight to the listeners like the real 'connect' handler would
        expect(calls).toBe(2)
    })
})

describe('shared session chat', () => {
    function Follow({ id }) {
        useRealtimeSession(id)
        return null
    }

    it('joins the session room while shown and leaves it afterwards', () => {
        const { unmount } = render(<Follow id={5} />)
        expect(fake.socket.emit).toHaveBeenCalledWith('session:join', 5)
        unmount()
        expect(fake.socket.emit).toHaveBeenCalledWith('session:leave', 5)
    })

    const session = (events) => ({ id: 5, name: 'Lernen', people: [], tasks: [], events })
    const message = (id, text) => ({ id, type: 'message', text, user: ben, createdAt: now() })

    it('adds a live chat message once, and a slower poll does not take it away again', () => {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch({ type: SET_SHARED_SESSION, payload: { session: session([message(1, 'a')]), seq: 1 } })

        store.dispatch({ type: SHARED_SESSION_EVENT, payload: { sessionId: 5, event: message(2, 'b') } })
        store.dispatch({ type: SHARED_SESSION_EVENT, payload: { sessionId: 5, event: message(2, 'b') } })
        // another session's chat doesn't end up here
        store.dispatch({ type: SHARED_SESSION_EVENT, payload: { sessionId: 6, event: message(9, 'x') } })
        expect(store.getState().together.current.events.map(e => e.text)).toEqual(['a', 'b'])

        // a poll that left the server before message 2 was written
        store.dispatch({ type: SET_SHARED_SESSION, payload: { session: session([message(1, 'a')]), seq: 2 } })
        expect(store.getState().together.current.events.map(e => e.text)).toEqual(['a', 'b'])

        // a newer poll has it itself: still once
        store.dispatch({ type: SET_SHARED_SESSION, payload: { session: session([message(1, 'a'), message(2, 'b'), message(3, 'c')]), seq: 3 } })
        expect(store.getState().together.current.events.map(e => e.text)).toEqual(['a', 'b', 'c'])
    })
})
