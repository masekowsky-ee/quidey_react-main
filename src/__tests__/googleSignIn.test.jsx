import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { signInWithGoogle, registerWithGoogle, deleteAccount } from '../features/auth/authAction'
import { GoogleSignupForm } from '../components/auth/GoogleSignIn'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const store = () => configureStore({ reducer: rootReducer })
const SIGNUP = { token: 'signup-token', email: 'gina@example.com', name: 'Gina', username: 'gina' }

beforeEach(() => {
    apiFetch.mockReset()
    localStorage.clear()
    sessionStorage.clear()
})

describe('sign in with Google: the thunks', () => {
    it('a known Google account signs in like a password', async () => {
        const s = store()
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/auth/google') return { token: 'tok', username: 'gina' }
            if (url === '/api/me') return { isPro: true, hasPassword: false, googleLinked: true }
            return {}
        })
        const result = await s.dispatch(signInWithGoogle('id-token'))
        expect(result).toBe(null)
        expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ idToken: 'id-token' })
        expect(localStorage.getItem('token')).toBe('tok')
        expect(s.getState().auth.user.username).toBe('gina')
        expect(s.getState().auth.access.hasPassword).toBe(false)
    })

    it('a new one answers what the sign-up form needs, which then makes the account', async () => {
        const s = store()
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/auth/google') return { signup: SIGNUP }
            if (url === '/api/auth/google/register') return { token: 'new', username: 'gina2' }
            if (url === '/api/me') return { isPro: false }
            return {}
        })
        expect(await s.dispatch(signInWithGoogle('id-token'))).toEqual(SIGNUP)
        await s.dispatch(registerWithGoogle({ signupToken: 'signup-token', username: 'gina2', displayName: 'Gina', birthDate: '2000-01-01' }))
        const body = JSON.parse(apiFetch.mock.calls.find(([url]) => url === '/api/auth/google/register')[1].body)
        expect(body).toMatchObject({ signupToken: 'signup-token', username: 'gina2', display_name: 'Gina', birth_date: '2000-01-01', accept_terms: true, accept_privacy: true, confirm_age: true })
        expect(localStorage.getItem('token')).toBe('new')
    })

    it('an account without a password is deleted with its username', async () => {
        const s = store()
        apiFetch.mockResolvedValue({})
        await s.dispatch(deleteAccount({ confirmUsername: 'gina' }))
        expect(apiFetch).toHaveBeenCalledWith('/api/users', { method: 'DELETE', body: JSON.stringify({ confirmUsername: 'gina' }) })
    })
})

describe('sign in with Google: the return from Google', () => {
    it('takes the token only for a sign-in started here (state), and once', async () => {
        vi.resetModules()
        sessionStorage.setItem('googleState', 'abc')
        window.history.replaceState(null, '', '/auth/google#state=abc&id_token=tok123')
        const { readGoogleReturn } = await import('../features/auth/google')
        expect(readGoogleReturn()).toEqual({ idToken: 'tok123' })
        expect(window.location.hash).toBe('')
        expect(sessionStorage.getItem('googleState')).toBe(null)
        expect(readGoogleReturn()).toEqual({ idToken: 'tok123' })
    })

    it('refuses an answer to a sign-in that wasn\'t started here', async () => {
        vi.resetModules()
        sessionStorage.setItem('googleState', 'mine')
        window.history.replaceState(null, '', '/auth/google#state=theirs&id_token=evil')
        const { readGoogleReturn } = await import('../features/auth/google')
        expect(readGoogleReturn()).toEqual({ error: 'failed' })
    })
})

describe('sign in with Google: the rest of a new account', () => {
    it('asks for name, birth date, username and the consents; too young is refused before the server', async () => {
        const errors = []
        render(<Provider store={store()}><MemoryRouter><GoogleSignupForm signup={SIGNUP} onCancel={() => {}} onError={(m) => errors.push(m)} /></MemoryRouter></Provider>)
        expect(screen.getByText('gina@example.com')).toBeInTheDocument()
        expect(screen.getByLabelText('Anzeigename')).toHaveValue('Gina')
        expect(screen.getByLabelText('Benutzer Name')).toHaveValue('gina')
        fireEvent.change(screen.getByLabelText('Geburtsdatum'), { target: { value: '2020-01-01' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Konto erstellen' })) })
        expect(errors.at(-1)).toMatch(/14/)
        expect(apiFetch).not.toHaveBeenCalled()
    })
})
