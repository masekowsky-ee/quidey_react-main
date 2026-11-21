import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { makeStore } from './helpers/store'
import { LOGIN_SUCCESS, SET_ACCESS } from '../features/auth/authActionTypes'
import App from '../App'

// Quidey opens for everybody: without an account the app shows, empty, and what needs an
// account asks for one in a window
function Where() { return <output data-testid="where">{useLocation().pathname}</output> }

async function renderApp(path = '/', hash = '') {
    window.history.replaceState(null, '', path + hash)
    const store = makeStore()
    await act(async () => {
        render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /><Where /></MemoryRouter></Provider>)
    })
    return store
}

// the header's own button (the drawer has one too)
const headerSignIn = () => within(document.querySelector('[data-part="header"]')).getByRole('button', { name: 'Anmelden' })

// the server answers every list empty and says the account may use the app
const ANSWERS = {
    '/api/me': { isPro: true },
    '/api/users': [{ username: 'ann' }],
    '/api/friends/requests': { incoming: [], outgoing: [] },
    '/api/shared-sessions': { sessions: [], invites: [] },
}
const server = (url) => ({ ok: true, status: 200, json: async () => ANSWERS[String(url)] ?? [] })

beforeEach(() => {
    localStorage.clear()
    globalThis.fetch = vi.fn(async (url) => server(url))
})

describe('the app without an account', () => {
    it('opens the app itself, not a sign-in page, and asks the server for nothing', async () => {
        await renderApp('/')
        expect(screen.getAllByText('Quidey').length).toBeGreaterThan(0)
        expect(headerSignIn()).toBeInTheDocument()
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('shows nothing that belongs to an account: no inbox in the header, a sign-in button at the foot of the menu', async () => {
        await renderApp('/')
        expect(within(document.querySelector('[data-part="header"]')).queryByRole('link', { name: 'Postfach' })).toBeNull()
        expect(within(document.querySelector('[data-part="menu"]')).getByRole('button', { name: 'Anmelden' })).toBeInTheDocument()
    })

    it('the sign-in button in the header opens the window', async () => {
        await renderApp('/')
        await act(async () => { headerSignIn().click() })
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('a page that needs an account opens the window and stays there', async () => {
        await renderApp('/settings')
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByTestId('where')).toHaveTextContent('/settings')
    })

    it('/signup opens the window on signing up, back on the start page', async () => {
        await renderApp('/signup')
        expect(screen.getByRole('tab', { name: 'Registrieren' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByTestId('where')).toHaveTextContent('/')
        expect(screen.getByTestId('where')).not.toHaveTextContent('signup')
    })

    it('takes the address from the landing page\'s email line and clears it from the address bar', async () => {
        await renderApp('/signup', '#email=ben%40example.org')
        expect(screen.getByLabelText('E-Mail')).toHaveValue('ben@example.org')
        expect(window.location.hash).toBe('')
    })

    it('/signin opens the window on signing in', async () => {
        await renderApp('/signin')
        expect(screen.getByRole('tab', { name: 'Anmelden' })).toHaveAttribute('aria-selected', 'true')
    })

    it('the legal pages open without a window', async () => {
        await renderApp('/impressum')
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('after signing in the page that was asked for opens', async () => {
        const store = await renderApp('/settings')
        localStorage.setItem('token', 't')
        await act(async () => {
            store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 't', username: 'ann' } })
            store.dispatch({ type: SET_ACCESS, payload: { isPro: true } })
        })
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(screen.getByTestId('where')).toHaveTextContent('/settings')
    })
})
