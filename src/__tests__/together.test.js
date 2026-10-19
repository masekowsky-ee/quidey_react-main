import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import togetherReducer, { idleWork } from '../features/together/togetherReducer'
import { apiFetch, formatDuration } from '../features/helperFunction'
import {
    fetchSharedSessions, fetchSharedSession, createSharedSession, joinSharedSession,
    removeSharedMember, deleteSharedSession, reportSharedActivity, selectInviteCount, timeOf,
} from '../features/together/togetherAction'
import { SET_SHARED_SESSION, SET_SHARED_SESSIONS, SHARED_SESSION_GONE } from '../features/together/togetherActionTypes'
import { LOGOUT } from '../features/auth/authActionTypes'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const session = (id, extra = {}) => ({ id, name: `S${id}`, people: [], tasks: [], ...extra })
const summary = (id) => ({ id, name: `S${id}`, memberCount: 1, workingCount: 0, totalMs: 0, myMs: 0 })
const initial = togetherReducer(undefined, { type: '@@INIT' })
const makeStore = () => configureStore({ reducer: rootReducer })
const apiError = (status, code) => Object.assign(new Error(code), { status, code })

beforeEach(() => { apiFetch.mockReset() })

describe('togetherReducer', () => {
    it('starts empty', () => {
        expect(initial).toEqual({ sessions: [], invites: [], current: null, currentSeq: 0, work: idleWork })
    })

    it('ignores a session that comes from an older request than the one shown', () => {
        const newer = togetherReducer(initial, { type: SET_SHARED_SESSION, payload: { session: session(1, { name: 'new' }), seq: 5 } })
        const late = togetherReducer(newer, { type: SET_SHARED_SESSION, payload: { session: session(1, { name: 'old' }), seq: 4 } })
        expect(late.current.name).toBe('new')
    })

    it('drops the invite once its session is shown (joined)', () => {
        const state = togetherReducer(
            { ...initial, invites: [summary(1), summary(2)] },
            { type: SET_SHARED_SESSION, payload: { session: session(1), seq: 1 } },
        )
        expect(state.invites.map(i => i.id)).toEqual([2])
    })

    it('forgets a session that is gone everywhere', () => {
        const state = togetherReducer(
            { ...initial, sessions: [summary(1), summary(2)], invites: [summary(3)], current: session(1), currentSeq: 1 },
            { type: SHARED_SESSION_GONE, payload: 1 },
        )
        expect(state.current).toBeNull()
        expect(state.sessions.map(s => s.id)).toEqual([2])
    })

    it('resets on logout', () => {
        const state = togetherReducer({ ...initial, sessions: [summary(1)] }, { type: LOGOUT })
        expect(state).toEqual(initial)
    })
})

describe('together thunks', () => {
    it('loads sessions and invites', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue({ sessions: [summary(1)], invites: [summary(2)] })
        await store.dispatch(fetchSharedSessions())
        expect(apiFetch).toHaveBeenCalledWith('/api/shared-sessions')
        expect(selectInviteCount(store.getState())).toBe(1)
    })

    it('creates a session with the invited friends', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue(session(7))
        const created = await store.dispatch(createSharedSession('Study', [2, 3]))
        expect(apiFetch).toHaveBeenCalledWith('/api/shared-sessions', {
            method: 'POST', body: JSON.stringify({ name: 'Study', friendIds: [2, 3] }),
        })
        expect(created.id).toBe(7)
        expect(store.getState().together.current.id).toBe(7)
    })

    it('a newer change wins over a slow poll that started earlier', async () => {
        const store = makeStore()
        let answerPoll
        apiFetch
            .mockImplementationOnce(() => new Promise(resolve => { answerPoll = resolve }))
            .mockResolvedValueOnce(session(1, { name: 'after join' }))
        const poll = store.dispatch(fetchSharedSession(1))
        await store.dispatch(joinSharedSession(1))
        answerPoll(session(1, { name: 'stale' }))
        await poll
        expect(store.getState().together.current.name).toBe('after join')
    })

    it('a 404 removes the session', async () => {
        const store = makeStore()
        store.dispatch({ type: SET_SHARED_SESSIONS, payload: { sessions: [summary(1)], invites: [] } })
        apiFetch.mockRejectedValue(apiError(404, 'SESSION_NOT_FOUND'))
        await expect(store.dispatch(fetchSharedSession('1'))).rejects.toThrow()
        expect(store.getState().together.sessions).toEqual([])
    })

    it('sends activity with keepalive when asked', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue(session(1))
        await store.dispatch(reportSharedActivity(1, { currentTaskId: null, time: { taskId: 4, ms: 3000 } }, { keepalive: true }))
        expect(apiFetch).toHaveBeenCalledWith('/api/shared-sessions/1/activity', {
            method: 'POST',
            body: JSON.stringify({ currentTaskId: null, time: { taskId: 4, ms: 3000 } }),
            keepalive: true,
        })
    })

    it('leaving removes the session, removing someone else reloads it', async () => {
        const store = makeStore()
        store.dispatch({ type: SET_SHARED_SESSIONS, payload: { sessions: [summary(1)], invites: [] } })
        apiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce(session(1))
        await store.dispatch(removeSharedMember(1, 9, 5))
        expect(apiFetch).toHaveBeenLastCalledWith('/api/shared-sessions/1', undefined)
        expect(store.getState().together.sessions).toHaveLength(1)

        apiFetch.mockResolvedValueOnce({})
        await store.dispatch(removeSharedMember(1, 5, 5))
        expect(apiFetch).toHaveBeenLastCalledWith('/api/shared-sessions/1/members/5', { method: 'DELETE' })
        expect(store.getState().together.sessions).toEqual([])
    })

    it('deletes a session', async () => {
        const store = makeStore()
        store.dispatch({ type: SET_SHARED_SESSIONS, payload: { sessions: [summary(1)], invites: [] } })
        apiFetch.mockResolvedValue({ id: 1 })
        await store.dispatch(deleteSharedSession(1))
        expect(store.getState().together.sessions).toEqual([])
    })
})

describe('helpers', () => {
    it('timeOf finds one person\'s time on a task', () => {
        const task = { time: [{ userId: 2, ms: 5000 }] }
        expect(timeOf(task, 2)).toBe(5000)
        expect(timeOf(task, 3)).toBe(0)
    })

    it('formatDuration', () => {
        expect(formatDuration(0)).toBe('0 s')
        expect(formatDuration(45000)).toBe('45 s')
        expect(formatDuration(60000)).toBe('1 min')
        expect(formatDuration(3900000)).toBe('1 h 5 min')
        expect(formatDuration(undefined)).toBe('0 s')
    })
})
