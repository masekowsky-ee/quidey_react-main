import { describe, it, expect, beforeEach } from 'vitest'
import { screen, act } from '@testing-library/react'
import { makeStore } from './helpers/store'
import { renderWithStore } from './helpers/render'
import { LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { openAuth } from '../features/auth/gate'
import AuthDialog from '../components/auth/AuthDialog'
import { LANDING_URL } from '../features/site'

// The window that asks a visitor to sign in or up (opened by openAuth)
function setup() {
    const store = makeStore()
    renderWithStore(<AuthDialog />, { store })
    return store
}
const open = (...args) => act(() => openAuth(...args))

describe('auth dialog', () => {
    beforeEach(() => localStorage.removeItem('token'))

    it('is not there until something asks for it', () => {
        setup()
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('opens on signing in', () => {
        setup()
        open()
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Anmelden' })).toHaveAttribute('aria-selected', 'true')
    })

    it('opens on signing up with the address that came along', () => {
        setup()
        open('signup', { email: 'ben@example.org' })
        expect(screen.getByRole('tab', { name: 'Registrieren' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByLabelText('E-Mail')).toHaveValue('ben@example.org')
    })

    it('a second ask does not open a second window', () => {
        setup()
        open()
        open()
        expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })

    it('has the way back to the landing page', () => {
        setup()
        open()
        expect(screen.getByRole('link', { name: 'Was ist Quidey?' })).toHaveAttribute('href', LANDING_URL)
    })

    it('goes away once somebody is signed in', () => {
        const store = setup()
        open()
        act(() => { store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 't', username: 'ann' } }) })
        expect(screen.queryByRole('dialog')).toBeNull()
    })
})
