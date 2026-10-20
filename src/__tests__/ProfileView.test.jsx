import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_USER } from '../features/auth/authActionTypes'
import { SET_WORKED_SESSIONS } from '../features/session/sessionActionTypes'
import ProfileView from '../components/ProfileView'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const me = { username: 'jo', display_name: 'Jo Berg', email: 'jo@example.com', birth_date: '2000-01-01T00:00:00Z', created_at: '2026-08-15T12:00:00Z' }
const apiError = (status, code) => Object.assign(new Error(code), { status, code })

async function renderProfile() {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_USER, payload: [me] })
    store.dispatch({ type: SET_WORKED_SESSIONS, payload: [{ id: 1, totalTime: 1500 }, { id: 2, totalTime: 2100 }] })
    const onSignOut = vi.fn()
    await act(async () => {
        render(<Provider store={store}><ProfileView onSignOut={onSignOut} /></Provider>)
    })
    return { store, onSignOut }
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('ProfileView', () => {
    beforeEach(() => {
        apiFetch.mockReset()
        // the friends list is loaded on open
        apiFetch.mockImplementation(async (url) => url === '/api/friends' ? [{ id: 2, username: 'anna' }] : {})
    })

    it('shows identity, member since and stats', async () => {
        await renderProfile()
        expect(screen.getByRole('heading', { name: 'Jo Berg' })).toBeInTheDocument()
        expect(screen.getByText('@jo')).toBeInTheDocument()
        expect(screen.getByText(/Mitglied seit/)).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()       // sessions
        expect(screen.getByText('1 h 0 min')).toBeInTheDocument() // 25 + 35 minutes
        expect(screen.getByText('1')).toBeInTheDocument()       // friends
    })

    describe('editing the profile', () => {
        it('saves display name and email', async () => {
            const { store } = await renderProfile()
            fireEvent.click(screen.getByRole('button', { name: 'Profil bearbeiten' }))
            type('Anzeigename', '  Jo B.  ')
            apiFetch.mockResolvedValueOnce({ ...me, display_name: 'Jo B.' })

            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })) })

            expect(apiFetch).toHaveBeenLastCalledWith('/api/users', expect.objectContaining({ method: 'PUT' }))
            expect(JSON.parse(apiFetch.mock.calls.at(-1)[1].body)).toEqual({ display_name: 'Jo B.', email: 'jo@example.com' })
            expect(store.getState().auth.user.display_name).toBe('Jo B.')
            expect(screen.getByText('Profil gespeichert.')).toBeInTheDocument()
        })

        it('explains a taken email and stays in the form', async () => {
            await renderProfile()
            fireEvent.click(screen.getByRole('button', { name: 'Profil bearbeiten' }))
            apiFetch.mockRejectedValueOnce(apiError(409, 'EMAIL_TAKEN'))

            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })) })

            expect(screen.getByText('Diese E-Mail-Adresse wird schon verwendet.')).toBeInTheDocument()
            expect(screen.getByLabelText('E-Mail')).toBeInTheDocument()
        })

        it('can be cancelled without saving', async () => {
            await renderProfile()
            fireEvent.click(screen.getByRole('button', { name: 'Profil bearbeiten' }))
            type('Anzeigename', 'Something else')
            fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))

            expect(apiFetch).not.toHaveBeenCalledWith('/api/users', expect.anything())
            expect(screen.getByRole('heading', { name: 'Jo Berg' })).toBeInTheDocument()
        })
    })

    describe('changing the password', () => {
        it('checks length and confirmation before asking the server', async () => {
            await renderProfile()
            type('Aktuelles Passwort', 'old-password')
            type('Neues Passwort', 'short')
            type('Passwort bestätigen', 'short')
            fireEvent.submit(screen.getByLabelText('Neues Passwort').closest('form'))
            expect(screen.getByText('Das neue Passwort muss 8–72 Zeichen lang sein.')).toBeInTheDocument()

            type('Neues Passwort', 'long-enough-1')
            type('Passwort bestätigen', 'long-enough-2')
            fireEvent.submit(screen.getByLabelText('Neues Passwort').closest('form'))
            expect(screen.getByText('Die Passwörter stimmen nicht überein')).toBeInTheDocument()

            expect(apiFetch).not.toHaveBeenCalledWith('/api/users/password', expect.anything())
        })

        it('changes it and clears the fields', async () => {
            await renderProfile()
            type('Aktuelles Passwort', 'old-password')
            type('Neues Passwort', 'new-password')
            type('Passwort bestätigen', 'new-password')
            apiFetch.mockResolvedValueOnce({ message: 'Password changed' })

            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Passwort ändern' })) })

            expect(JSON.parse(apiFetch.mock.calls.at(-1)[1].body)).toEqual({ currentPassword: 'old-password', newPassword: 'new-password' })
            expect(screen.getByText('Passwort geändert.')).toBeInTheDocument()
            expect(screen.getByLabelText('Aktuelles Passwort')).toHaveValue('')
        })

        it('says when the current password is wrong', async () => {
            await renderProfile()
            type('Aktuelles Passwort', 'wrong')
            type('Neues Passwort', 'new-password')
            type('Passwort bestätigen', 'new-password')
            apiFetch.mockRejectedValueOnce(apiError(401, 'WRONG_PASSWORD'))

            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Passwort ändern' })) })

            expect(screen.getByText('Das aktuelle Passwort ist falsch.')).toBeInTheDocument()
        })
    })

    it('signs out', async () => {
        const { onSignOut } = await renderProfile()
        fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))
        expect(onSignOut).toHaveBeenCalled()
    })

    describe('deleting the account', () => {
        it('needs the password, then deletes and signs out', async () => {
            localStorage.setItem('token', 't')
            const { store } = await renderProfile()
            fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }))
            const confirm = screen.getByRole('button', { name: 'Endgültig löschen' })
            expect(confirm).toBeDisabled()

            type('Zur Bestätigung dein Passwort', 'secret123')
            apiFetch.mockResolvedValueOnce({ message: 'Account deleted' })
            await act(async () => { fireEvent.click(confirm) })

            expect(apiFetch).toHaveBeenLastCalledWith('/api/users', expect.objectContaining({ method: 'DELETE' }))
            expect(JSON.parse(apiFetch.mock.calls.at(-1)[1].body)).toEqual({ password: 'secret123' })
            expect(store.getState().auth.token).toBeNull()
            expect(localStorage.getItem('token')).toBeNull()
        })

        it('keeps the account and says why on a wrong password or as the last admin', async () => {
            const { store } = await renderProfile()
            store.dispatch({ type: 'LOGIN_SUCCESS', payload: { token: 't', username: 'jo' } })
            fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }))

            type('Zur Bestätigung dein Passwort', 'wrong')
            apiFetch.mockRejectedValueOnce(apiError(401, 'WRONG_PASSWORD'))
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' })) })
            expect(screen.getByText('Das aktuelle Passwort ist falsch.')).toBeInTheDocument()
            expect(screen.getByLabelText('Zur Bestätigung dein Passwort')).toHaveValue('')

            type('Zur Bestätigung dein Passwort', 'secret123')
            apiFetch.mockRejectedValueOnce(apiError(409, 'LAST_ADMIN'))
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' })) })
            expect(screen.getByText(/einzige Admin/)).toBeInTheDocument()
            expect(store.getState().auth.token).toBe('t')
        })
    })
})
