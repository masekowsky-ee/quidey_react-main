import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import SignIn from '../components/SignIn'
import { LANDING_URL } from '../features/site'

// The landing page (its own site) sends people here: "Anmelden" to /signin, "Beta-Platz sichern"
// and its email line to /signup, the address as #email=…
function renderAt(path, hash = '') {
    window.history.replaceState(null, '', path + hash)
    render(
        <Provider store={configureStore({ reducer: rootReducer })}>
            <MemoryRouter initialEntries={[path]}><SignIn /></MemoryRouter>
        </Provider>
    )
}

describe('sign-in screen', () => {
    beforeEach(() => localStorage.removeItem('token'))

    it('/signin opens on signing in, with the way back to the landing page', () => {
        renderAt('/signin')
        expect(screen.getByRole('tab', { name: 'Anmelden' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('link', { name: 'Was ist Quidey?' })).toHaveAttribute('href', LANDING_URL)
        expect(screen.getByRole('link', { name: 'Impressum' })).toBeInTheDocument()
    })

    it('/signup opens on signing up', () => {
        renderAt('/signup')
        expect(screen.getByRole('tab', { name: 'Registrieren' })).toHaveAttribute('aria-selected', 'true')
    })

    it('takes the address from the landing page\'s email line and clears it from the address bar', () => {
        renderAt('/signup', '#email=ben%40example.org')
        expect(screen.getByLabelText('E-Mail')).toHaveValue('ben@example.org')
        expect(window.location.hash).toBe('')
    })
})
