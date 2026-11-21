import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, within, cleanup } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import App from '../App'
import { resetInviteForTests } from '../features/guest/tourInvite'

// A visitor without an account gets a short tour (5 cards), invited by a quiet card on the start page
async function renderApp(path = '/') {
    window.history.replaceState(null, '', path)
    const store = configureStore({ reducer: rootReducer })
    await act(async () => {
        render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></Provider>)
    })
    return store
}

const invite = () => document.querySelector('[data-part="guest-tour-invite"]')
const tour = () => screen.queryByRole('dialog', { name: 'Willkommen bei Quidey!' })
const click = (el) => act(async () => { el.click() })

beforeEach(() => {
    localStorage.clear()
    resetInviteForTests()
    globalThis.fetch = vi.fn()
})

describe('the guest tour', () => {
    it('is offered on the start page, quietly: no tour opens by itself', async () => {
        await renderApp('/')
        expect(invite()).not.toBeNull()
        expect(tour()).toBeNull()
    })

    it('is not offered anywhere else', async () => {
        await renderApp('/calendar')
        expect(invite()).toBeNull()
    })

    it('"Kurz erklärt" opens the short tour: five cards from welcome to the account', async () => {
        await renderApp('/')
        await click(within(invite()).getByRole('button', { name: 'Kurz erklärt' }))
        expect(tour()).toBeInTheDocument()
        expect(screen.getByText('1 / 5')).toBeInTheDocument()
        expect(screen.queryByText('Lernen mit Freunden')).toBeNull()
    })

    it('the last card asks to sign up, and "Konto erstellen" opens the window on signing up', async () => {
        await renderApp('/')
        await click(within(invite()).getByRole('button', { name: 'Kurz erklärt' }))
        for (let i = 0; i < 4; i++) await click(screen.getByRole('button', { name: 'Weiter' }))
        expect(screen.getByRole('heading', { name: 'Bereit zum Loslegen?' })).toBeInTheDocument()
        await click(screen.getByRole('button', { name: 'Konto erstellen' }))
        expect(tour()).toBeNull()
        expect(screen.getByRole('tab', { name: 'Registrieren' })).toHaveAttribute('aria-selected', 'true')
    })

    it('"Nicht jetzt" puts the card away for good, and so does opening the tour', async () => {
        await renderApp('/')
        await click(within(invite()).getByRole('button', { name: 'Nicht jetzt' }))
        expect(invite()).toBeNull()
        expect(localStorage.getItem('guestTourInvite')).toBe('done')
        cleanup()
        resetInviteForTests()
        await renderApp('/')
        expect(invite()).toBeNull()
    })

    it('stays reachable from the menu after the card is gone', async () => {
        localStorage.setItem('guestTourInvite', 'done')
        await renderApp('/')
        await click(within(document.querySelector('[data-part="menu"]')).getByRole('button', { name: 'Kurz erklärt' }))
        expect(tour()).toBeInTheDocument()
    })
})
