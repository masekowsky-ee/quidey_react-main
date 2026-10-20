import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_USER } from '../features/auth/authActionTypes'
import Profile from '../components/profile'
import ProfileView from '../components/ProfileView'
import VerifyEmail from '../components/VerifyEmail'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const apiError = (status, code) => Object.assign(new Error(code), { status, code })
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const newStore = () => configureStore({ reducer: rootReducer })

async function renderSignedOut() {
    localStorage.removeItem('token')
    const store = newStore()
    await act(async () => { render(<Provider store={store}><Profile /></Provider>) })
    return store
}

async function renderVerifyPage(token) {
    const store = newStore()
    await act(async () => {
        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={[`/verify-email?token=${token}`]}>
                    <Routes><Route path="/verify-email" element={<VerifyEmail />} /></Routes>
                </MemoryRouter>
            </Provider>
        )
    })
    return store
}

describe('email verification', () => {
    beforeEach(() => {
        apiFetch.mockReset()
        apiFetch.mockResolvedValue({})
    })

    it('after signing up asks to confirm the address instead of signing in', async () => {
        const store = await renderSignedOut()
        fireEvent.click(screen.getByRole('tab', { name: 'Registrieren' }))
        type('E-Mail', 'ann@example.com')
        type('Anzeigename', 'Ann')
        type('Geburtsdatum', '1990-05-01')
        type('Benutzer Name', 'ann')
        type('Passwort', 'password123')
        type('Passwort bestätigen', 'password123')

        // without accepting the terms nothing is sent
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Registrieren' })) })
        expect(apiFetch).not.toHaveBeenCalled()
        expect(screen.getByText('Bitte akzeptiere die Nutzungsbedingungen.')).toBeInTheDocument()

        // each of the three is required on its own
        fireEvent.click(screen.getByRole('checkbox', { name: /Nutzungsbedingungen/ }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Registrieren' })) })
        expect(screen.getByText(/Datenschutzerklärung gelesen hast/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('checkbox', { name: /Datenschutzerklärung/ }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Registrieren' })) })
        expect(screen.getByText('Bitte bestätige dein Alter.')).toBeInTheDocument()
        expect(apiFetch).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('checkbox', { name: /mindestens 14 Jahre/ }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Registrieren' })) })

        expect(apiFetch).toHaveBeenCalledTimes(1)
        expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual(expect.objectContaining({ accept_terms: true, accept_privacy: true, confirm_age: true }))
        expect(apiFetch).toHaveBeenCalledWith('/api/register', expect.objectContaining({ method: 'POST' }))
        expect(store.getState().auth.token).toBeNull()
        expect(screen.getByText(/Bitte bestätige deine E-Mail-Adresse/)).toBeInTheDocument()
        expect(screen.getByText(/ann@example\.com/)).toBeInTheDocument()
    })

    it('sign-in refused for an unconfirmed address offers a new link by email', async () => {
        await renderSignedOut()
        type('Benutzername oder E-Mail', 'ann')
        type('Passwort', 'password123')
        apiFetch.mockRejectedValueOnce(apiError(403, 'EMAIL_NOT_VERIFIED'))

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Anmelden' })) })

        expect(screen.getByText('Bitte bestätige zuerst deine E-Mail-Adresse')).toBeInTheDocument()
        type('E-Mail', 'ann@example.com')
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Neuen Link senden' })) })

        expect(apiFetch).toHaveBeenLastCalledWith('/api/resend-verification', expect.objectContaining({ method: 'POST' }))
        expect(JSON.parse(apiFetch.mock.calls.at(-1)[1].body)).toEqual({ email: 'ann@example.com' })
        expect(screen.getByText(/ein neuer Link unterwegs/)).toBeInTheDocument()
    })

    it('signing in with the unconfirmed address fills it into the new-link form', async () => {
        await renderSignedOut()
        type('Benutzername oder E-Mail', 'ann@example.com')
        type('Passwort', 'password123')
        apiFetch.mockRejectedValueOnce(apiError(403, 'EMAIL_NOT_VERIFIED'))

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Anmelden' })) })

        expect(screen.getByLabelText('E-Mail')).toHaveValue('ann@example.com')
    })

    it('the verify page confirms the token once', async () => {
        await renderVerifyPage('a'.repeat(64))
        expect(apiFetch).toHaveBeenCalledTimes(1)
        expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ token: 'a'.repeat(64) })
        expect(screen.getByText('E-Mail-Adresse bestätigt')).toBeInTheDocument()
    })

    it('the verify page explains an expired link and offers a new one', async () => {
        apiFetch.mockRejectedValueOnce(apiError(400, 'TOKEN_EXPIRED'))
        await renderVerifyPage('b'.repeat(64))
        expect(screen.getByText('Der Link ist abgelaufen')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Neuen Link senden' })).toBeInTheDocument()
    })

    it('the profile marks an unconfirmed address and sends a new link', async () => {
        const store = newStore()
        store.dispatch({ type: SET_USER, payload: [{ username: 'jo', email: 'jo@example.com', email_verified: false }] })
        apiFetch.mockImplementation(async (url) => url === '/api/friends' ? [] : { sent: true })
        await act(async () => { render(<Provider store={store}><ProfileView onSignOut={() => {}} /></Provider>) })

        expect(screen.getByText('Nicht bestätigt')).toBeInTheDocument()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Neuen Link senden' })) })
        expect(apiFetch).toHaveBeenLastCalledWith('/api/verify-email/resend', { method: 'POST' })
    })
})
