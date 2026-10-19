import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import authReducer from '../features/auth/authReducer'
import { apiFetch, PRO_REQUIRED_EVENT } from '../features/helperFunction'
import { loginSuccess, requestBetaAccess } from '../features/auth/authAction'
import { SET_ACCESS, LOGOUT } from '../features/auth/authActionTypes'
import App from '../App'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const pending = { status: 'pending', reason: 'I want to plan my study group', createdAt: '2026-10-19T08:00:00Z' }

// GET /api/me answers with `me`; everything a pro user would load gets empty lists
function mockApi(me) {
    const state = { me }
    apiFetch.mockImplementation(async (url, options = {}) => {
        if (url === '/api/login') return { token: 'tok' }
        if (url === '/api/me') return state.me
        if (url === '/api/beta-requests') {
            const reason = JSON.parse(options.body).reason
            state.me = { ...state.me, betaRequest: { status: 'pending', reason, createdAt: '2026-10-19T09:00:00Z' } }
            return state.me.betaRequest
        }
        if (url === '/api/users') return [{ username: 'ann' }]
        if (url === '/api/tasks') return []
        if (url === '/api/groups') return []
        if (url === '/api/notes') return []
        if (url === '/api/sessions') return []
        if (url === '/api/friends/requests') return { incoming: [], outgoing: [] }
        if (url === '/api/shared-sessions') return { sessions: [], invites: [] }
        throw new Error(`unexpected call ${options.method ?? 'GET'} ${url}`)
    })
    return state
}

async function renderApp(path = '/') {
    const store = configureStore({ reducer: rootReducer })
    await act(async () => {
        render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></Provider>)
    })
    return store
}

async function signIn(store) {
    await act(async () => { await store.dispatch(loginSuccess('ann', 'secret')) })
}

beforeEach(() => {
    apiFetch.mockReset()
    localStorage.clear()
    // checkAuth uses fetch directly; nothing is stored, so it never gets that far
    globalThis.fetch = vi.fn()
})

describe('access state', () => {
    it('is unknown until the server answers, and reset on logout', () => {
        let state = authReducer(undefined, { type: '@@INIT' })
        expect(state.access).toEqual({ checked: false, isPro: false, isAdmin: false, adminPendingCount: 0, betaRequest: null })
        state = authReducer(state, { type: SET_ACCESS, payload: { isPro: false, betaRequest: pending } })
        expect(state.access).toEqual({ checked: true, isPro: false, isAdmin: false, adminPendingCount: 0, betaRequest: pending })
        state = authReducer(state, { type: LOGOUT })
        expect(state.access.checked).toBe(false)
    })

    it('a beta request keeps the pro flag as it is', async () => {
        const store = configureStore({ reducer: rootReducer })
        apiFetch.mockResolvedValue(pending)
        await store.dispatch(requestBetaAccess('I want to plan my study group'))
        expect(apiFetch).toHaveBeenCalledWith('/api/beta-requests', { method: 'POST', body: JSON.stringify({ reason: 'I want to plan my study group' }) })
        expect(store.getState().auth.access).toEqual({ checked: true, isPro: false, isAdmin: false, adminPendingCount: 0, betaRequest: pending })
    })
})

describe('closed beta', () => {
    it('sends users without pro to the beta screen after signing in, and loads none of the app data', async () => {
        mockApi({ userId: 1, username: 'ann', isPro: false, betaRequest: null })
        const store = await renderApp('/history')
        await signIn(store)
        expect(screen.getByRole('heading', { name: 'Quidey ist in der geschlossenen Beta' })).toBeInTheDocument()
        expect(screen.getByText('@ann')).toBeInTheDocument()
        const called = apiFetch.mock.calls.map(([url]) => url)
        expect(called).not.toContain('/api/tasks')
        expect(called).not.toContain('/api/shared-sessions')
    })

    it('asks for access once, with a reason of at least 10 characters', async () => {
        mockApi({ userId: 1, username: 'ann', isPro: false, betaRequest: null })
        const store = await renderApp()
        await signIn(store)
        const textarea = screen.getByLabelText('Warum möchtest du an der Beta teilnehmen?')
        const submit = screen.getByRole('button', { name: 'Zugang anfragen' })

        fireEvent.change(textarea, { target: { value: 'too short' } })
        expect(submit).toBeDisabled()
        expect(screen.getByText('9/1000')).toBeInTheDocument()

        fireEvent.change(textarea, { target: { value: '  I want to plan my study group  ' } })
        await act(async () => { fireEvent.click(submit) })
        expect(apiFetch).toHaveBeenCalledWith('/api/beta-requests', { method: 'POST', body: JSON.stringify({ reason: 'I want to plan my study group' }) })

        // the form is gone for good; the request is shown instead
        expect(screen.getByText('Anfrage gesendet')).toBeInTheDocument()
        expect(screen.getByText('I want to plan my study group')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Zugang anfragen' })).not.toBeInTheDocument()
    })

    it('shows a declined request without a way to ask again', async () => {
        mockApi({ userId: 1, username: 'ann', isPro: false, betaRequest: { ...pending, status: 'declined' } })
        const store = await renderApp()
        await signIn(store)
        expect(screen.getByText('Anfrage abgelehnt')).toBeInTheDocument()
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Erneut prüfen' })).not.toBeInTheDocument()
    })

    it('lets the user in as soon as pro is granted ("check again")', async () => {
        const api = mockApi({ userId: 1, username: 'ann', isPro: false, betaRequest: pending })
        const store = await renderApp()
        await signIn(store)
        api.me = { ...api.me, isPro: true, betaRequest: { ...pending, status: 'approved' } }
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut prüfen' })) })
        expect(screen.queryByRole('heading', { name: 'Quidey ist in der geschlossenen Beta' })).not.toBeInTheDocument()
        expect(apiFetch.mock.calls.map(([url]) => url)).toContain('/api/tasks')
    })

    it('pro users go straight to the app, and back to the beta screen when pro is taken away', async () => {
        const api = mockApi({ userId: 1, username: 'ann', isPro: true, betaRequest: null })
        const store = await renderApp('/beta')
        await signIn(store)
        expect(screen.queryByRole('heading', { name: 'Quidey ist in der geschlossenen Beta' })).not.toBeInTheDocument()

        // the server refused a request: access is checked again
        api.me = { ...api.me, isPro: false }
        await act(async () => { window.dispatchEvent(new Event(PRO_REQUIRED_EVENT)) })
        expect(screen.getByRole('heading', { name: 'Quidey ist in der geschlossenen Beta' })).toBeInTheDocument()
    })
})
