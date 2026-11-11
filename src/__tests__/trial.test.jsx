import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS, SET_USER } from '../features/auth/authActionTypes'
import { LIMIT_EVENT } from '../features/pro/pro'
import BetaGate from '../components/BetaGate'
import LimitDialog from '../components/pro/LimitDialog'
import ProfileView from '../components/ProfileView'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

function Where() {
    const location = useLocation()
    return <span data-testid="where">{location.pathname}</span>
}

function renderWith(ui, { path = '/', access = {} } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: false, accessMode: 'beta', ...access } })
    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[path]}>
                <Routes><Route path="*" element={<>{ui}<Where /></>} /></Routes>
            </MemoryRouter>
        </Provider>
    )
    return store
}

beforeEach(() => {
    apiFetch.mockReset()
    localStorage.clear()
})

describe('the access state', () => {
    it('knows whether the account is on the trial version', () => {
        const store = renderWith(<span />, { access: { trial: true } })
        expect(store.getState().auth.access.trial).toBe(true)
        const other = renderWith(<span />, { access: {} })
        expect(other.getState().auth.access.trial).toBe(false)
    })
})

describe('the beta screen offers the trial version', () => {
    it('"Mit der Testversion weitermachen" starts it and asks for the access again', async () => {
        apiFetch.mockImplementation(async (url) => (url === '/api/me' ? { isPro: true, trial: true, limits: { tasks: 10 }, usage: { tasks: 0 } } : { trial: true }))
        const store = renderWith(<BetaGate />, { path: '/beta' })
        expect(screen.getByText(/Alle Funktionen kostenlos, mit Grenzen/)).toBeInTheDocument()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mit der Testversion weitermachen' })) })
        expect(apiFetch).toHaveBeenCalledWith('/api/trial', expect.objectContaining({ method: 'POST' }))
        await waitFor(() => expect(store.getState().auth.access.trial).toBe(true))
        expect(store.getState().auth.access.isPro).toBe(true)
    })

    it('the apply form stays beside it', () => {
        renderWith(<BetaGate />, { path: '/beta' })
        expect(screen.getByRole('button', { name: /Beta-Zugang anfragen|Zugang anfragen/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Mit der Testversion weitermachen' })).toBeInTheDocument()
    })

    it('on the trial version the screen is the way to apply, with a way back and no second trial button', () => {
        renderWith(<BetaGate />, { path: '/beta', access: { isPro: true, trial: true } })
        expect(screen.queryByRole('button', { name: 'Mit der Testversion weitermachen' })).toBeNull()
        expect(screen.getByRole('link', { name: 'Zurück zur App' })).toHaveAttribute('href', '/')
    })

    it('a failed start says so', async () => {
        apiFetch.mockRejectedValue(Object.assign(new Error('x'), { status: 500 }))
        renderWith(<BetaGate />, { path: '/beta' })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mit der Testversion weitermachen' })) })
        expect(screen.getByRole('alert')).toBeInTheDocument()
    })
})

describe('a limit of the trial version', () => {
    const hit = (limit, max) => act(() => { window.dispatchEvent(new CustomEvent(LIMIT_EVENT, { detail: { limit, max } })) })

    it('subjects: said kindly, with the way to the beta card', async () => {
        apiFetch.mockImplementation(async () => ({}))
        renderWith(<LimitDialog />, { access: { isPro: true, trial: true } })
        hit('subjects', 3)
        expect(screen.getByText(/3 Fächer/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Beta-Zugang beantragen' }))
        expect(screen.getByTestId('where')).toHaveTextContent('/beta')
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('goals: one active goal per subject', () => {
        apiFetch.mockImplementation(async () => ({}))
        renderWith(<LimitDialog />, { access: { isPro: true, trial: true } })
        hit('goals', 1)
        expect(screen.getByText(/1 aktives Ziel/)).toBeInTheDocument()
    })
})

describe('the profile', () => {
    async function profile(access) {
        apiFetch.mockImplementation(async (url) => (url === '/api/friends' ? [] : {}))
        const store = configureStore({ reducer: rootReducer })
        store.dispatch({ type: SET_USER, payload: [{ username: 'jo', display_name: 'Jo', email: 'jo@example.com', birth_date: '2000-01-01T00:00:00Z', created_at: '2026-08-15T12:00:00Z' }] })
        store.dispatch({ type: SET_ACCESS, payload: { isPro: true, accessMode: 'beta', ...access } })
        await act(async () => {
            render(<Provider store={store}><MemoryRouter><ProfileView onSignOut={vi.fn()} /><Where /></MemoryRouter></Provider>)
        })
    }

    it('shows the trial card with the way to apply for beta', async () => {
        await profile({ trial: true, limits: { tasks: 10 }, usage: { tasks: 4 } })
        expect(screen.getByRole('heading', { name: 'Testversion' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Beta-Zugang beantragen/ })).toHaveAttribute('href', '/beta')
    })

    it('has no such card without the trial', async () => {
        await profile({ trial: false })
        expect(screen.queryByRole('heading', { name: 'Testversion' })).toBeNull()
    })
})
