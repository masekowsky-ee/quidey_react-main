import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { loginSuccess, logout } from '../features/auth/authAction'
import { switchAccount } from '../features/auth/accounts'
import { track, setUsageEnabled, resetUsage } from '../features/usage/usage'
import App from '../App'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const queued = () => JSON.parse(sessionStorage.getItem('usageQueue') ?? 'null')?.events ?? []

beforeEach(() => {
    apiFetch.mockReset()
    localStorage.clear()
    sessionStorage.clear()
    resetUsage()
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 204, json: async () => ({}) }))
})

describe('App and the usage statistics', () => {
    it('counts the first page view of a start once consent is granted', async () => {
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/login') return { token: 'tok' }
            if (url === '/api/me') return { userId: 1, username: 'ann', isPro: true, usageConsent: { choice: 'granted', at: 'x', version: 1 } }
            if (url === '/api/users') return [{ username: 'ann' }]
            if (url === '/api/friends/requests') return { incoming: [], outgoing: [] }
            if (url === '/api/shared-sessions') return { sessions: [], invites: [] }
            return []
        })
        const store = configureStore({ reducer: rootReducer })
        await act(async () => {
            render(<Provider store={store}><MemoryRouter initialEntries={['/stats']}><App /></MemoryRouter></Provider>)
        })
        await act(async () => { await store.dispatch(loginSuccess('ann', 'secret')) })
        expect(JSON.parse(sessionStorage.getItem('usageQueue')).userId).toBe(1)
        const metrics = queued().map(e => e.metric)
        expect(metrics.filter(m => m === 'view:stats')).toHaveLength(1)
        expect(metrics).toContain('app_open')
    })
})

describe('accounts and the queue', () => {
    const away = () => {
        const assign = vi.fn()
        Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } })
        return assign
    }

    it('a switch of account sends and keeps nothing of the old one', async () => {
        localStorage.setItem('token', 'tokA')
        localStorage.setItem('accounts', JSON.stringify([{ username: 'bob', token: 'tokB' }]))
        away()
        setUsageEnabled(true, 1)
        track('app_open')
        switchAccount('bob')
        document.dispatchEvent(new Event('visibilitychange'))
        await Promise.resolve()
        expect(globalThis.fetch).not.toHaveBeenCalled()
        expect(sessionStorage.getItem('usageQueue')).toBe(null)
    })

    it('signing out takes the queue along', () => {
        localStorage.setItem('token', 'tokA')
        const store = configureStore({ reducer: rootReducer })
        away()
        setUsageEnabled(true, 1)
        track('app_open')
        store.dispatch(logout())
        expect(sessionStorage.getItem('usageQueue')).toBe(null)
    })

    it('a stale queue from before the page loaded is cleared by a no', () => {
        sessionStorage.setItem('usageQueue', JSON.stringify([{ metric: 'app_open', at: Date.now() }]))
        setUsageEnabled(false)
        expect(sessionStorage.getItem('usageQueue')).toBe(null)
    })
})
