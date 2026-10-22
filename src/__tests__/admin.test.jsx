import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import Admin from '../components/Admin'
import Menu from '../components/Menu'
import App from '../App'
import TesterOnly from '../components/TesterOnly'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const adminUser = { id: 4, username: 'testUser1', displayName: 'test User 1', email: 'a@x.de', createdAt: '2026-10-01T10:00:00Z', isPro: true, isAdmin: true, isTester: false, request: null }
const asker = {
    id: 7, username: 'newbie', displayName: 'New Bie', email: 'n@x.de', createdAt: '2026-10-18T10:00:00Z', isPro: false, isAdmin: false, isTester: false,
    request: { status: 'pending', reason: 'I want to plan my study group', createdAt: '2026-10-19T08:00:00Z', decidedAt: null },
}
const proUser = { id: 3, username: 'testUser2', displayName: 'test_name', email: 'b@x.de', createdAt: '2026-10-02T10:00:00Z', isPro: true, isAdmin: false, isTester: false, request: null }

function makeStore({ isAdmin = true, pending = 1 } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'testUser1' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin, adminPendingCount: pending, betaRequest: null } })
    return store
}

let calls
function mockApi() {
    calls = []
    const state = { asker: structuredClone(asker), pro: structuredClone(proUser) }
    apiFetch.mockImplementation(async (url, options = {}) => {
        calls.push({ url, method: options.method ?? 'GET', body: options.body && JSON.parse(options.body) })
        if (url === '/api/me') return { isPro: true, isAdmin: true, adminPendingCount: state.asker.request?.status === 'pending' ? 1 : 0 }
        if (url === '/api/admin/requests') return state.asker.request?.status === 'pending' ? [state.asker] : []
        if (url === '/api/admin/requests/7/approve') {
            state.asker = { ...state.asker, isPro: true, request: { ...state.asker.request, status: 'approved' } }
            return state.asker
        }
        if (url.startsWith('/api/admin/users') && !options.method) return [adminUser, state.pro, state.asker]
        if (url === '/api/admin/users/3' && options.method === 'PATCH') {
            state.pro = { ...state.pro, ...JSON.parse(options.body) }
            return state.pro
        }
        if (url === '/api/admin/overview') return {
            users: 3, withAccess: 2, admins: 1, testers: 0, pendingRequests: 1, newThisWeek: 1, openSharedSessions: 0,
            actions: [{ id: 1, admin: 'testUser1', target: 'testUser2', action: 'grant_pro', createdAt: new Date().toISOString() }],
        }
        throw new Error(`unexpected call ${options.method ?? 'GET'} ${url}`)
    })
}

async function renderAdmin(path = '/admin', store = makeStore()) {
    await act(async () => {
        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={[path]}>
                    <Routes><Route path="/admin" element={<Admin />} /></Routes>
                </MemoryRouter>
            </Provider>
        )
    })
    return store
}

beforeEach(() => {
    apiFetch.mockReset()
    mockApi()
})

describe('menu', () => {
    const renderMenu = (store) => render(<Provider store={store}><MemoryRouter><Menu /></MemoryRouter></Provider>)

    it('shows the admin panel with open requests to admins', () => {
        renderMenu(makeStore({ isAdmin: true, pending: 2 }))
        const link = screen.getByRole('link', { name: /Admin/ })
        expect(link).toHaveAttribute('href', '/admin')
        expect(within(link).getByText('2')).toBeInTheDocument()
    })

    it('not to everybody else', () => {
        renderMenu(makeStore({ isAdmin: false }))
        expect(screen.queryByRole('link', { name: /Admin/ })).not.toBeInTheDocument()
    })
})

describe('admin route', () => {
    it('sends non-admins home', async () => {
        const store = makeStore({ isAdmin: false })
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/me') return { isPro: true, isAdmin: false }
            if (url === '/api/users') return [{ username: 'testUser1' }]
            if (url === '/api/friends/requests') return { incoming: [], outgoing: [] }
            if (url === '/api/shared-sessions') return { sessions: [], invites: [] }
            return []
        })
        globalThis.fetch = vi.fn()
        await act(async () => {
            render(<Provider store={store}><MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter></Provider>)
        })
        expect(screen.queryByRole('heading', { name: 'Admin' })).not.toBeInTheDocument()
        expect(apiFetch.mock.calls.map(([url]) => url).some(url => url.startsWith('/api/admin'))).toBe(false)
    })
})

describe('admin panel', () => {
    it('approves a beta request and updates the badge', async () => {
        const store = await renderAdmin()
        expect(screen.getByText('I want to plan my study group')).toBeInTheDocument()
        expect(screen.getByText('@newbie · n@x.de')).toBeInTheDocument()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Freischalten' })) })
        expect(calls.some(c => c.url === '/api/admin/requests/7/approve' && c.method === 'POST')).toBe(true)
        expect(screen.getByText('Keine offenen Anfragen.')).toBeInTheDocument()
        expect(store.getState().toast.map(toast => toast.text)).toContain('New Bie ist freigeschaltet')
        expect(store.getState().auth.access.adminPendingCount).toBe(0)
    })

    it('takes pro away, and asks before changing admin rights', async () => {
        await renderAdmin('/admin?tab=users')
        const row = (await screen.findByText('test_name')).closest('li')
        const pro = within(row).getByRole('switch', { name: /Pro/ })
        expect(pro).toHaveAttribute('aria-checked', 'true')
        await act(async () => { fireEvent.click(pro) })
        expect(calls.at(-2)).toMatchObject({ url: '/api/admin/users/3', method: 'PATCH', body: { isPro: false } })
        expect(within(row).getByRole('switch', { name: /Pro/ })).toHaveAttribute('aria-checked', 'false')

        await act(async () => { fireEvent.click(within(row).getByRole('switch', { name: /Admin/ })) })
        expect(within(row).getByText('Zum Admin machen?')).toBeInTheDocument()
        expect(calls.some(c => c.body?.isAdmin !== undefined)).toBe(false)
        await act(async () => { fireEvent.click(within(row).getByRole('button', { name: 'Ja' })) })
        expect(calls.some(c => c.url === '/api/admin/users/3' && c.body?.isAdmin === true)).toBe(true)
    })

    it('makes someone a tester without asking', async () => {
        await renderAdmin('/admin?tab=users')
        const row = (await screen.findByText('test_name')).closest('li')
        const tester = within(row).getByRole('switch', { name: /Tester/ })
        expect(tester).toHaveAttribute('aria-checked', 'false')
        await act(async () => { fireEvent.click(tester) })
        expect(calls.at(-2)).toMatchObject({ url: '/api/admin/users/3', method: 'PATCH', body: { isTester: true } })
        expect(within(row).getByRole('switch', { name: /Tester/ })).toHaveAttribute('aria-checked', 'true')
        expect(within(row).getAllByText('Tester').length).toBeGreaterThan(0)
    })

    it('has no switches on my own row', async () => {
        await renderAdmin('/admin?tab=users')
        const me = (await screen.findByText('test User 1')).closest('li')
        expect(within(me).queryByRole('switch')).not.toBeInTheDocument()
        expect(within(me).getByText('Das bist du')).toBeInTheDocument()
    })

    it('shows numbers and the log of admin actions', async () => {
        await renderAdmin('/admin?tab=overview')
        expect(screen.getByText('Mit Zugang').previousSibling).toHaveTextContent('2')
        expect(screen.getByText('testUser1 hat testUser2 Pro gegeben')).toBeInTheDocument()
    })
})

describe('tester-only content', () => {
    const renderWith = (isTester) => {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isTester } })
        render(<Provider store={store}><TesterOnly fallback={<p>Alt</p>}><p>Neu</p></TesterOnly></Provider>)
    }

    it('shows the new thing to testers', () => {
        renderWith(true)
        expect(screen.getByText('Neu')).toBeInTheDocument()
        expect(screen.queryByText('Alt')).not.toBeInTheDocument()
    })

    it('shows the fallback to everybody else', () => {
        renderWith(false)
        expect(screen.getByText('Alt')).toBeInTheDocument()
        expect(screen.queryByText('Neu')).not.toBeInTheDocument()
    })
})
