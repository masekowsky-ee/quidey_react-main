import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { connectRealtime, disconnectRealtime, useRealtimeRefresh, useSafetyPoll, REFRESH_DELAY_MS, REALTIME_RECONNECT } from '../features/realtime/socket'
import { useLiveLists } from '../features/realtime/useLiveLists'
import { othersRunningMs, othersWorking, OTHERS_MAX_MS } from '../features/together/work'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

// A stand-in for the Socket.IO connection: serverSends() plays an event from the server
const fake = vi.hoisted(() => ({ socket: null }))
vi.mock('socket.io-client', () => ({
    io: vi.fn(() => {
        let any = null
        fake.socket = {
            connected: true, emit: vi.fn(), on: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
            onAny: (handler) => { any = handler },
            fire: (event, payload) => any?.(event, payload),
        }
        return fake.socket
    }),
}))

const serverSends = (event, payload) => act(() => { fake.socket.fire(event, payload) })
const wait = (ms) => act(() => { vi.advanceTimersByTime(ms) })

beforeEach(async () => {
    vi.useFakeTimers()
    apiFetch.mockReset()
    apiFetch.mockResolvedValue([])
    await connectRealtime()
})
afterEach(() => {
    disconnectRealtime()
    vi.useRealTimers()
})

describe('loading again on changes', () => {
    function Refresh({ refresh, accept }) {
        useRealtimeRefresh(['session:changed'], refresh, accept)
        return null
    }

    it('loads once for a burst of changes, shortly after the last one', async () => {
        const refresh = vi.fn()
        render(<Refresh refresh={refresh} />)
        await serverSends('session:changed', { sessionId: 1 })
        await serverSends('session:changed', { sessionId: 1 })
        await serverSends('session:changed', { sessionId: 1 })
        expect(refresh).not.toHaveBeenCalled()
        await wait(REFRESH_DELAY_MS)
        expect(refresh).toHaveBeenCalledTimes(1)
    })

    it('skips changes that are about something else, but loads after a reconnect', async () => {
        const refresh = vi.fn()
        render(<Refresh refresh={refresh} accept={(event, payload) => payload?.sessionId === 1} />)
        await serverSends('session:changed', { sessionId: 2 })
        await wait(REFRESH_DELAY_MS)
        expect(refresh).not.toHaveBeenCalled()
        await serverSends(REALTIME_RECONNECT)
        await wait(REFRESH_DELAY_MS)
        expect(refresh).toHaveBeenCalledTimes(1)
    })

    it('stops listening when the page is gone', async () => {
        const refresh = vi.fn()
        const { unmount } = render(<Refresh refresh={refresh} />)
        await serverSends('session:changed', { sessionId: 1 })
        unmount()
        await wait(REFRESH_DELAY_MS)
        expect(refresh).not.toHaveBeenCalled()
    })

    it('loads the lists a change is about: friends, sessions and invites, shared tasks', async () => {
        function Lists() { useLiveLists(); return null }
        render(<Provider store={configureStore({ reducer: rootReducer })}><Lists /></Provider>)
        const urls = () => apiFetch.mock.calls.map(([url]) => url)

        await serverSends('friends:changed', {})
        await wait(REFRESH_DELAY_MS)
        expect(urls()).toEqual(expect.arrayContaining(['/api/friends', '/api/friends/requests']))
        expect(urls()).not.toContain('/api/shared-sessions')

        apiFetch.mockClear()
        await serverSends('invites:changed', {})
        await wait(REFRESH_DELAY_MS)
        expect(urls()).toEqual(expect.arrayContaining(['/api/shared-sessions', '/api/shared-sessions/my-tasks']))

        apiFetch.mockClear()
        await serverSends('tasks:changed', { taskId: 4 })
        await wait(REFRESH_DELAY_MS)
        expect(urls()).toEqual(expect.arrayContaining(['/api/tasks', '/api/task-shares']))
    })
})

describe('news from the live lists', () => {
    const ben = { id: 2, username: 'ben', displayName: 'Ben' }
    function Lists() { useLiveLists(); return null }
    const routes = (map) => apiFetch.mockImplementation(async (url) => map[url] ?? [])

    it('pops up a new friend request and a new session invite, and marks the changes', async () => {
        const store = configureStore({ reducer: rootReducer })
        render(<Provider store={store}><Lists /></Provider>)
        routes({ '/api/friends/requests': { incoming: [{ id: 1, user: ben, createdAt: '' }], outgoing: [] }, '/api/friends': [] })
        await serverSends('friends:changed', {})
        await wait(REFRESH_DELAY_MS)
        await act(async () => {})
        expect(store.getState().toast.map(toast => [toast.text, toast.to])).toEqual([['Freundschaftsanfrage von Ben', '/social?tab=requests']])

        // the same list again: nothing new
        await serverSends('friends:changed', {})
        await wait(REFRESH_DELAY_MS)
        await act(async () => {})
        expect(store.getState().toast).toHaveLength(1)

        routes({ '/api/shared-sessions': { sessions: [], invites: [{ id: 5, name: 'Mathe', owner: ben, memberCount: 1 }] } })
        await serverSends('invites:changed', {})
        await wait(REFRESH_DELAY_MS)
        await act(async () => {})
        expect(store.getState().toast.at(-1)).toMatchObject({ text: 'Ben lädt dich in eine Session ein', detail: 'Mathe', to: '/together' })

        expect(store.getState().news.together).toBe(false)
        await serverSends('session:changed', { sessionId: 5 })
        expect(store.getState().news.together).toBe(true)
    })
})

describe("counting the others' time on between loads", () => {
    const session = {
        id: 5, me: 1, endedAt: null, receivedAt: 1_000_000,
        people: [
            { user: { id: 1 }, workingOn: 7 },
            { user: { id: 2 }, workingOn: 7 },
            { user: { id: 3 }, workingOn: null },
        ],
    }

    it('counts on for somebody else working, on their task only', () => {
        expect(othersRunningMs(session, 2, 7, 1_012_000)).toBe(12_000)
        expect(othersRunningMs(session, 2, undefined, 1_012_000)).toBe(12_000)
        expect(othersRunningMs(session, 2, 8, 1_012_000)).toBe(0)
        expect(othersWorking(session)).toBe(true)
    })

    it('not for me (my own stopwatch counts that), idle people or an ended session', () => {
        expect(othersRunningMs(session, 1, 7, 1_012_000)).toBe(0)
        expect(othersRunningMs(session, 3, undefined, 1_012_000)).toBe(0)
        expect(othersRunningMs({ ...session, endedAt: '2026-10-21' }, 2, 7, 1_012_000)).toBe(0)
        expect(othersWorking({ ...session, people: session.people.slice(0, 1) })).toBe(false)
    })

    it('stops after a while: somebody may have left without the server knowing', () => {
        expect(othersRunningMs(session, 2, 7, 1_000_000 + 10 * OTHERS_MAX_MS)).toBe(OTHERS_MAX_MS)
    })
})

describe('the polling safety net', () => {
    function Poll({ run }) {
        useSafetyPoll(run, { everyMs: 1000, connectedEveryMs: 5000 })
        return null
    }

    it('rests while live updates arrive, and polls as usual without them', async () => {
        const run = vi.fn()
        render(<Poll run={run} />)
        await wait(4000)
        expect(run).not.toHaveBeenCalled()
        await wait(1000)
        expect(run).toHaveBeenCalledTimes(1)

        fake.socket.connected = false
        await wait(3000)
        expect(run).toHaveBeenCalledTimes(4)
    })

    it('loads on focus only when the connection is down (a reconnect loads by itself)', async () => {
        const run = vi.fn()
        render(<Poll run={run} />)
        await act(() => { window.dispatchEvent(new Event('focus')) })
        expect(run).not.toHaveBeenCalled()
        fake.socket.connected = false
        await act(() => { window.dispatchEvent(new Event('focus')) })
        expect(run).toHaveBeenCalledTimes(1)
    })
})
