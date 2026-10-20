import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import authReducer from '../features/auth/authReducer'
import { checkAuth, loginSuccess, logout } from '../features/auth/authAction'
import { LOGIN_SUCCESS, SET_USER } from '../features/auth/authActionTypes'

const makeStore = () => configureStore({ reducer: rootReducer })
const respond = (ok, body, status = ok ? 200 : 400) => fetch.mockResolvedValue({ ok, status, json: () => Promise.resolve(body) })

beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => vi.unstubAllGlobals())

describe('authReducer', () => {
    const initial = authReducer(undefined, { type: '@@INIT' })

    it('LOGIN_SUCCESS stores token and username', () => {
        const state = authReducer(initial, { type: LOGIN_SUCCESS, payload: { token: 't', username: 'jo' } })
        expect(state.token).toBe('t')
        expect(state.user.username).toBe('jo')
    })

    it('SET_USER reads the first row the API returns', () => {
        // GET /api/users answers with an array of rows
        const row = { username: 'jo', display_name: 'Jo', email: 'jo@x.de', birth_date: '2000-01-01' }
        const state = authReducer(initial, { type: SET_USER, payload: [row] })
        expect(state.user).toEqual(row)
    })
})

describe('loginSuccess', () => {
    it('saves the token so a reload stays signed in', async () => {
        const store = makeStore()
        respond(true, { token: 'abc' })

        await store.dispatch(loginSuccess('jo', 'secret'))

        expect(localStorage.getItem('token')).toBe('abc')
        expect(store.getState().auth.token).toBe('abc')
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ username: 'jo', password: 'secret' })
    })

    it('keeps the real username after signing in with the email address', async () => {
        const store = makeStore()
        respond(true, { token: 'abc', username: 'jo' })

        await store.dispatch(loginSuccess('jo@example.com', 'secret'))

        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ username: 'jo@example.com', password: 'secret' })
        expect(store.getState().auth.user.username).toBe('jo')
    })

    it('stays signed out and rethrows on wrong credentials', async () => {
        const store = makeStore()
        respond(false, { error: 'Invalid sign in' })

        await expect(store.dispatch(loginSuccess('jo', 'wrong'))).rejects.toThrow('Invalid sign in')
        expect(localStorage.getItem('token')).toBeNull()
    })
})

describe('logout', () => {
    it('forgets the token everywhere', () => {
        const store = makeStore()
        localStorage.setItem('token', 'abc')
        store.dispatch(logout())
        expect(localStorage.getItem('token')).toBeNull()
        expect(store.getState().auth.token).toBeNull()
    })
})

describe('checkAuth', () => {
    it('does nothing without a stored token', async () => {
        await makeStore().dispatch(checkAuth())
        expect(fetch).not.toHaveBeenCalled()
    })

    it('keeps a token the server accepts', async () => {
        const store = makeStore()
        localStorage.setItem('token', 'good')
        respond(true, { userId: 3, username: 'jo' })

        await store.dispatch(checkAuth())

        expect(store.getState().auth.token).toBe('good')
        expect(store.getState().auth.user.username).toBe('jo')
    })

    it('signs out when the server rejects the token', async () => {
        const store = makeStore()
        localStorage.setItem('token', 'expired')
        respond(false, { error: 'Token invalid or expired' }, 403)

        await store.dispatch(checkAuth())

        expect(localStorage.getItem('token')).toBeNull()
        expect(store.getState().auth.token).toBeNull()
    })

    it('signs out when no valid token is sent at all (401)', async () => {
        const store = makeStore()
        localStorage.setItem('token', 'garbage')
        respond(false, { error: 'No existing token' }, 401)

        await store.dispatch(checkAuth())

        expect(localStorage.getItem('token')).toBeNull()
    })

    it('keeps the token when the backend is not reachable', async () => {
        const store = makeStore()
        localStorage.setItem('token', 'good')
        fetch.mockRejectedValue(new TypeError('Failed to fetch'))

        await store.dispatch(checkAuth())

        expect(localStorage.getItem('token')).toBe('good')
    })

    it('keeps the token on a server error', async () => {
        // the dev proxy answers 500 while the backend is down
        const store = makeStore()
        localStorage.setItem('token', 'good')
        respond(false, {}, 500)

        await store.dispatch(checkAuth())

        expect(localStorage.getItem('token')).toBe('good')
    })
})
