import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch, toCsv, SIGNED_OUT_EVENT } from '../features/helperFunction'
import { changePassword, logoutEverywhere } from '../features/auth/authAction'
import { LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { contentSecurityPolicy, headersFile } from '../../security-headers.js'
import App from '../App'

const respond = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })

beforeEach(() => {
    localStorage.clear()
    globalThis.fetch = vi.fn()
})
afterEach(() => { vi.restoreAllMocks() })

describe('CSV export', () => {
    it('turns would-be formulas into plain text', () => {
        expect(toCsv([['=HYPERLINK("http://evil","x")', '+1', '-2', '@SUM(A1)', 'normal', -5]]))
            .toBe(`"'=HYPERLINK(""http://evil"",""x"")",'+1,'-2,'@SUM(A1),normal,-5`)
    })
})

describe('ended logins', () => {
    it('a revoked or expired token signs out; other errors do not', async () => {
        localStorage.setItem('token', 'old')
        const signedOut = vi.fn()
        window.addEventListener(SIGNED_OUT_EVENT, signedOut)

        fetch.mockReturnValueOnce(respond(401, { error: 'Signed out', code: 'TOKEN_REVOKED' }))
        await expect(apiFetch('/api/tasks')).rejects.toThrow()
        fetch.mockReturnValueOnce(respond(403, { error: 'Token invalid or expired', code: 'TOKEN_INVALID' }))
        await expect(apiFetch('/api/tasks')).rejects.toThrow()
        expect(signedOut).toHaveBeenCalledTimes(2)

        // a wrong current password in the password form is a 401 too, but no reason to sign out
        fetch.mockReturnValueOnce(respond(401, { error: 'Current password is wrong', code: 'WRONG_PASSWORD' }))
        await expect(apiFetch('/api/users/password')).rejects.toThrow()
        expect(signedOut).toHaveBeenCalledTimes(2)
        window.removeEventListener(SIGNED_OUT_EVENT, signedOut)
    })

    it('the app signs out when the event comes', async () => {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'ann' } })
        localStorage.setItem('token', 'tok')
        fetch.mockReturnValue(respond(500, {}))
        await act(async () => {
            render(<Provider store={store}><MemoryRouter><App /></MemoryRouter></Provider>)
        })
        await act(async () => { window.dispatchEvent(new Event(SIGNED_OUT_EVENT)) })
        expect(store.getState().auth.token).toBeNull()
        expect(localStorage.getItem('token')).toBeNull()
    })
})

describe('password change and sign out everywhere', () => {
    it('keeps this device signed in with the new token', async () => {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'old', username: 'ann' } })
        fetch.mockReturnValueOnce(respond(200, { message: 'Password changed', token: 'new' }))
        await store.dispatch(changePassword('old-password', 'new-password'))
        expect(localStorage.getItem('token')).toBe('new')
        expect(store.getState().auth.token).toBe('new')
        expect(store.getState().auth.user.username).toBe('ann')
    })

    it('sign out everywhere ends this login too', async () => {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'ann' } })
        localStorage.setItem('token', 'tok')
        fetch.mockReturnValueOnce(respond(200, { message: 'Signed out everywhere' }))
        await store.dispatch(logoutEverywhere())
        expect(fetch.mock.calls[0][0]).toBe('/api/users/logout-all')
        expect(fetch.mock.calls[0][1].method).toBe('POST')
        expect(store.getState().auth.token).toBeNull()
    })
})

describe('security headers of the site', () => {
    it('allow the API server and nothing else to be called', () => {
        expect(contentSecurityPolicy('https://api.quidey.com/some/path')).toContain("connect-src 'self' https://api.quidey.com;")
        expect(contentSecurityPolicy('')).toContain("connect-src 'self';")
        expect(contentSecurityPolicy()).toContain("script-src 'self';")
        expect(contentSecurityPolicy()).toContain("frame-ancestors 'none'")
        expect(() => contentSecurityPolicy('not a url')).toThrow()
    })

    it('are written for every path', () => {
        const file = headersFile('https://api.quidey.com')
        expect(file.startsWith('/*\n')).toBe(true)
        for (const header of ['Content-Security-Policy', 'X-Content-Type-Options: nosniff', 'X-Frame-Options: DENY', 'Strict-Transport-Security', 'Referrer-Policy']) {
            expect(file).toContain(header)
        }
    })
})
