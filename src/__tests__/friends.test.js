import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import friendsReducer from '../features/friends/friendsReducer'
import { apiFetch } from '../features/helperFunction'
import {
    fetchFriends, fetchFriendRequests, sendFriendRequest, acceptFriendRequest,
    removeFriendRequest, removeFriend, selectIncomingCount,
} from '../features/friends/friendsAction'
import { SET_FRIENDS, SET_FRIEND_REQUESTS } from '../features/friends/friendsActionTypes'
import { LOGOUT } from '../features/auth/authActionTypes'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const user = (id, username, displayName = null) => ({ id, username, displayName })
const anna = user(2, 'anna', 'Anna')
const ben = user(3, 'ben')
const carla = user(4, 'carla', 'Carla')

const initial = friendsReducer(undefined, { type: '@@INIT' })
const loaded = [
    { type: SET_FRIENDS, payload: [anna] },
    { type: SET_FRIEND_REQUESTS, payload: {
        incoming: [{ id: 10, user: ben, createdAt: '2026-10-18T10:00:00Z' }],
        outgoing: [{ id: 11, user: carla, createdAt: '2026-10-18T11:00:00Z' }],
    } },
].reduce(friendsReducer, initial)

const makeStore = () => configureStore({ reducer: rootReducer })
const apiError = (status, code) => Object.assign(new Error(code), { status, code })

beforeEach(() => { apiFetch.mockReset() })

describe('friendsReducer', () => {
    it('starts empty', () => {
        expect(initial).toEqual({ friends: [], incoming: [], outgoing: [] })
    })

    it('loads friends and both request lists', () => {
        expect(loaded.friends).toEqual([anna])
        expect(loaded.incoming).toHaveLength(1)
        expect(loaded.outgoing).toHaveLength(1)
    })

    it('forgets everything on logout', () => {
        expect(friendsReducer(loaded, { type: LOGOUT })).toEqual(initial)
    })
})

describe('friends thunks', () => {
    it('fetchFriends and fetchFriendRequests load from the API', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValueOnce([anna]).mockResolvedValueOnce({ incoming: [], outgoing: [] })

        await store.dispatch(fetchFriends())
        await store.dispatch(fetchFriendRequests())

        expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/friends')
        expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/friends/requests')
        expect(store.getState().friends.friends).toEqual([anna])
    })

    it('sending a request adds it to "sent" and resolves to pending', async () => {
        const store = makeStore()
        const request = { id: 20, user: ben, createdAt: '2026-10-18T12:00:00Z' }
        apiFetch.mockResolvedValueOnce({ status: 'pending', request })

        await expect(store.dispatch(sendFriendRequest('ben'))).resolves.toBe('pending')

        expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ username: 'ben' })
        expect(store.getState().friends.outgoing).toEqual([request])
    })

    it('asking someone who already asked you makes you friends right away', async () => {
        const store = makeStore()
        store.dispatch({ type: SET_FRIEND_REQUESTS, payload: { incoming: [{ id: 10, user: ben }], outgoing: [] } })
        apiFetch.mockResolvedValueOnce({ status: 'accepted', friend: { ...ben, since: '2026-10-18' } })

        await expect(store.dispatch(sendFriendRequest('ben'))).resolves.toBe('accepted')

        const { friends, incoming } = store.getState().friends
        expect(friends.map(f => f.username)).toEqual(['ben'])
        expect(incoming).toEqual([]) // their request is answered
    })

    it('passes API errors on, with their code', async () => {
        const store = makeStore()
        apiFetch.mockRejectedValueOnce(apiError(404, 'USER_NOT_FOUND'))

        await expect(store.dispatch(sendFriendRequest('nobody'))).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
        expect(store.getState().friends.outgoing).toEqual([])
    })

    it('accepting moves the person from the inbox to friends, sorted by name', async () => {
        const store = makeStore()
        store.dispatch({ type: SET_FRIENDS, payload: [carla] })
        store.dispatch({ type: SET_FRIEND_REQUESTS, payload: { incoming: [{ id: 10, user: anna }], outgoing: [] } })
        apiFetch.mockResolvedValueOnce({ friend: { ...anna, since: '2026-10-18' } })

        await store.dispatch(acceptFriendRequest(10))

        expect(apiFetch).toHaveBeenCalledWith('/api/friends/requests/10/accept', { method: 'POST' })
        const { friends, incoming } = store.getState().friends
        expect(friends.map(f => f.username)).toEqual(['anna', 'carla'])
        expect(incoming).toEqual([])
        expect(selectIncomingCount(store.getState())).toBe(0)
    })

    it('declining or withdrawing removes the request from whichever list it is in', async () => {
        const store = makeStore()
        store.dispatch({ type: SET_FRIEND_REQUESTS, payload: { incoming: [{ id: 10, user: ben }], outgoing: [{ id: 11, user: carla }] } })
        apiFetch.mockResolvedValue({})

        await store.dispatch(removeFriendRequest(10))
        await store.dispatch(removeFriendRequest(11))

        expect(apiFetch).toHaveBeenCalledWith('/api/friends/requests/10', { method: 'DELETE' })
        expect(store.getState().friends.incoming).toEqual([])
        expect(store.getState().friends.outgoing).toEqual([])
    })

    it('removing a friend deletes them from the list', async () => {
        const store = makeStore()
        store.dispatch({ type: SET_FRIENDS, payload: [anna, carla] })
        apiFetch.mockResolvedValueOnce({ userId: 2 })

        await store.dispatch(removeFriend(2))

        expect(apiFetch).toHaveBeenCalledWith('/api/friends/2', { method: 'DELETE' })
        expect(store.getState().friends.friends).toEqual([carla])
    })

    it('a failed removal keeps the friend in the list', async () => {
        const store = makeStore()
        store.dispatch({ type: SET_FRIENDS, payload: [anna] })
        apiFetch.mockRejectedValueOnce(apiError(500))

        await expect(store.dispatch(removeFriend(2))).rejects.toThrow()
        expect(store.getState().friends.friends).toEqual([anna])
    })
})
