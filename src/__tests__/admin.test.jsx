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
import { downloadXlsx, downloadCsv } from '../features/admin/exportTable'

vi.mock('../features/admin/exportTable', () => ({
    downloadXlsx: vi.fn(async () => {}),
    downloadCsv: vi.fn(),
}))

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

const longName = 'a'.repeat(40)
const richUser = {
    id: 9, username: longName, displayName: longName, email: 'rich@x.de', createdAt: '2026-10-05T12:00:00Z', isPro: false, isAdmin: false, isTester: false,
    hasAvatar: true, request: null, birthDate: '1995-05-05', emailVerified: true, termsAcceptedAt: '2026-10-05T12:00:00Z', privacyAcceptedAt: '2026-10-05T12:05:00Z',
    language: 'de', timezone: 'Europe/Vienna', signIn: 'google', level: 4, isOwner: false, proUntil: null,
    usageConsent: { choice: 'granted', at: '2026-11-07T12:00:00Z', version: 1 },
}
const extraUser = { ...proUser, id: 20, username: 'second_page', displayName: 'Second Page', email: 's@x.de' }

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
        if (url === '/api/admin/users/export') return { users: [adminUser, state.pro, richUser] }
        if (url.startsWith('/api/admin/users?') && !options.method) {
            const page = Number(new URL(url, 'http://x').searchParams.get('page'))
            return page === 2 ? { users: [extraUser], total: 5 } : { users: [adminUser, state.pro, state.asker, richUser], total: 5 }
        }
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
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Freischalten (Tester)' })) })
        expect(calls.some(c => c.url === '/api/admin/requests/7/approve' && c.method === 'POST')).toBe(true)
        expect(screen.getByText('Keine offenen Anfragen.')).toBeInTheDocument()
        expect(store.getState().toast.map(toast => toast.text)).toContain('New Bie ist freigeschaltet (Tester)')
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
        expect(screen.getByText('testUser1 hat testUser2 Pro geschenkt')).toBeInTheDocument()
    })
})

describe('admin users: all fields', () => {
    const usersCall = () => new URL(calls.filter(c => c.url.startsWith('/api/admin/users?')).at(-1).url, 'http://x').searchParams

    it('shows a 40-character username in full', async () => {
        await renderAdmin('/admin?tab=users')
        const name = await screen.findAllByText(longName)
        expect(name[0].textContent).toBe(longName)
        expect(name[0].className).not.toMatch(/ellipsis|truncate/)
    })

    it('counts accounts by the total and requests page 1 sorted newest', async () => {
        await renderAdmin('/admin?tab=users')
        expect(await screen.findByText('5 Konten')).toBeInTheDocument()
        expect(usersCall().get('page')).toBe('1')
        expect(usersCall().get('sort')).toBe('newest')
    })

    it('opens the detail sheet by click and by Enter, listing every field', async () => {
        await renderAdmin('/admin?tab=users')
        const open = (await screen.findAllByRole('button', { name: new RegExp(longName) }))[0]
        await act(async () => { fireEvent.click(open) })
        const dialog = screen.getByRole('dialog')
        for (const label of ['ID', 'Anmeldung', 'E-Mail', 'Erstellt', 'Nutzungsbedingungen akzeptiert', 'Datenschutz akzeptiert', 'Sprache', 'Zeitzone',
            'Geburtsdatum', 'Level', 'Pro', 'Rollen', 'Beta-Anfrage', 'Nutzungsstatistik', 'Profilbild']) {
            expect(within(dialog).getByText(label)).toBeInTheDocument()
        }
        const text = dialog.textContent
        expect(text).toContain('AnmeldungGoogle')
        expect(text).toContain('NutzungsstatistikJa · 07.11.2026')
        expect(text).toContain('bestätigt')
        expect(text).toContain('Europe/Vienna')
        expect(text).toContain('05.05.1995')
        expect(within(dialog).getAllByText('–').length).toBeGreaterThan(0)
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Schließen' })) })
        await act(async () => { await new Promise(r => setTimeout(r, 400)) })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        // the person area is a real button, so Enter activates it
        const again = (await screen.findAllByRole('button', { name: new RegExp(longName) }))[0]
        expect(again.tagName).toBe('BUTTON')
        await act(async () => { fireEvent.click(again) })
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not open the sheet from the toggles', async () => {
        await renderAdmin('/admin?tab=users')
        const row = (await screen.findByText('test_name')).closest('li')
        await act(async () => { fireEvent.click(within(row).getByRole('switch', { name: /Tester/ })) })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('sorts by name, starting at page 1', async () => {
        await renderAdmin('/admin?tab=users')
        await screen.findByText('5 Konten')
        await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: 'Sortierung' }), { target: { value: 'name' } }) })
        await act(async () => { await new Promise(r => setTimeout(r, 20)) })
        expect(usersCall().get('sort')).toBe('name')
        expect(usersCall().get('page')).toBe('1')
        expect(screen.getByRole('option', { name: 'Neueste' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Älteste' })).toBeInTheDocument()
    })

    it('loads more on request and appends', async () => {
        await renderAdmin('/admin?tab=users')
        const more = await screen.findByText('Mehr laden')
        await act(async () => { fireEvent.click(more) })
        expect(usersCall().get('page')).toBe('2')
        expect(screen.getByText('Second Page')).toBeInTheDocument()
        expect(screen.getByText('test_name')).toBeInTheDocument()
    })

    it('ignores a "Mehr laden" answer that lands after the search changed', async () => {
        await renderAdmin('/admin?tab=users')
        const more = await screen.findByText('Mehr laden')
        const base = apiFetch.getMockImplementation()
        let resolveOld
        apiFetch.mockImplementation((url, options) => {
            const params = new URL(url, 'http://x').searchParams
            if (url.startsWith('/api/admin/users?') && params.get('page') === '2' && !params.get('q')) {
                return new Promise(resolve => { resolveOld = () => resolve({ users: [extraUser], total: 5 }) })
            }
            if (url.startsWith('/api/admin/users?') && params.get('q') === 'zed') return Promise.resolve({ users: [proUser], total: 1 })
            return base(url, options)
        })
        await act(async () => { fireEvent.click(more) })
        await act(async () => { fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zed' } }) })
        await act(async () => { await new Promise(r => setTimeout(r, 450)) })
        expect(screen.getByText('1 Konten')).toBeInTheDocument()
        await act(async () => { resolveOld() })
        expect(screen.queryByText('Second Page')).not.toBeInTheDocument()
        expect(screen.getByText('1 Konten')).toBeInTheDocument()
        expect(screen.queryByText('Mehr laden')).not.toBeInTheDocument()
    })

    it('exports every account with all columns and no secrets', async () => {
        await renderAdmin('/admin?tab=users')
        await screen.findByText('5 Konten')
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Excel/ })) })
        expect(calls.some(c => c.url === '/api/admin/users/export')).toBe(true)
        expect(downloadXlsx).toHaveBeenCalledTimes(1)
        const [sheets, fileName] = downloadXlsx.mock.calls[0]
        expect(fileName).toMatch(/^quidey-konten_\d{4}-\d{2}-\d{2}\.xlsx$/)
        expect(sheets).toHaveLength(1)
        expect(sheets[0].name).toBe('Konten')
        expect(sheets[0].rows).toHaveLength(3)
        expect(sheets[0].columns.map(c => c.label)).toContain('Geburtsdatum')
        expect(sheets[0].columns.some(c => /hash|token/i.test(c.key))).toBe(false)
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'CSV' })) })
        expect(downloadCsv).toHaveBeenCalledTimes(1)
        expect(downloadCsv.mock.calls[0][2]).toMatch(/^quidey-konten_\d{4}-\d{2}-\d{2}\.csv$/)
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
