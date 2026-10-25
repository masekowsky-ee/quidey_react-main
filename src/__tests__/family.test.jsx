import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { Provider, useDispatch } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { setLanguage } from '../features/settings/settingsAction'
import { SET_ACCESS } from '../features/auth/authActionTypes'
import { connectRealtime, disconnectRealtime, REFRESH_DELAY_MS } from '../features/realtime/socket'
import { useFamilyList } from '../features/family/family'
import { usePresenceRealtime } from '../features/presence/presence'
import Menu from '../components/Menu'
import TeamQuickPanel from '../components/together/TeamQuickPanel'
import Community from '../components/community/Community'
import Family from '../components/family/Family'
import FamilyPage from '../components/family/FamilyPage'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

// A stand-in for the Socket.IO connection: serverSends() plays an event from the server
const fake = vi.hoisted(() => ({ socket: null }))
vi.mock('socket.io-client', () => ({
    io: vi.fn(() => {
        let any = null
        fake.socket = {
            connected: true, emit: vi.fn(), on: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
            onAny: (handler) => { any = handler },
            fire: (event, payload) => any?.(event, payload),
        }
        return fake.socket
    }),
}))

const serverSends = (event, payload) => act(async () => { fake.socket.fire(event, payload) })
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_DELAY_MS + 10) })

const apiDate = (year, month, day) => new Date(year, month - 1, day).toISOString()
const BO = { id: 2, username: 'bo', displayName: 'Bo' }
const ME = { id: 1, username: 'me', displayName: 'Me' }

const FAMILY = {
    id: 3, name: 'The Bergs', me: 1, isOwner: false, owner: BO, createdAt: apiDate(2026, 9, 1),
    people: [
        { user: BO, status: 'joined', isOwner: true },
        { user: ME, status: 'joined', isOwner: false },
    ],
    tasks: [
        { id: 90, name: 'Grandma visits', due: apiDate(2026, 10, 24), due_time: '15:00', done: false, location: 'Home', addedBy: BO },
        { id: 91, name: 'Last week', due: apiDate(2026, 10, 12), done: false, addedBy: BO },
        { id: 92, name: 'Already done', due: apiDate(2026, 10, 25), done: true, addedBy: BO },
    ],
}

// routes: { 'GET /api/...': answer or (options) => answer }
const api = (routes) => apiFetch.mockImplementation(async (url, options = {}) => {
    const route = routes[`${options.method ?? 'GET'} ${url}`]
    if (route === undefined) return []
    return typeof route === 'function' ? route(options) : route
})
const sent = (method, url) => apiFetch.mock.calls.filter(([u, o = {}]) => u === url && (o.method ?? 'GET') === method)

// what the community page loads besides the tab
const COMMUNITY_API = {
    'GET /api/progress': {
        today: '2026-10-19', weekStart: '2026-10-19', xp: 0, sources: { focus: 0, tasks: 0, challenges: 0 },
        level: 1, unlockLevel: 1, levelStartXp: 0, nextLevelXp: 150, daily: [], weekly: [], streak: 0, shareActivity: true,
    },
    'GET /api/progress/friends': { weekStart: '2026-10-19', ranking: [] },
    'GET /api/feed': { entries: [], next: null },
}

function LocationSpy() {
    return <output data-testid="location" hidden>{useLocation().pathname}</output>
}

// what App does for every page: the families list, and who comes online or goes
function FamilyList() {
    useFamilyList(true)
    usePresenceRealtime(useDispatch())
    return null
}

function setup(path, { tester = true } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('en'))
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isTester: tester } })
    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[path]}>
                <FamilyList />
                <Routes>
                    <Route path="/menu" element={<Menu />} />
                    <Route path="/panel" element={<TeamQuickPanel />} />
                    <Route path="/family" element={<Family />} />
                    <Route path="/community/:tab" element={<Community />} />
                    <Route path="/family/:id" element={<FamilyPage />} />
                </Routes>
                <LocationSpy />
            </MemoryRouter>
        </Provider>
    )
    return store
}

beforeEach(async () => {
    // Monday, 19 October 2026
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date(2026, 9, 19, 10, 0))
    apiFetch.mockReset()
    apiFetch.mockResolvedValue([])
    await connectRealtime()
})
afterEach(() => {
    disconnectRealtime()
    vi.useRealTimers()
})

describe('Quidey Family', () => {
    it('is a tab of the community page for testers only; its invites count on the menu entry', async () => {
        api({ ...COMMUNITY_API, 'GET /api/families': { families: [], invites: [{ id: 3, name: 'The Bergs', owner: BO, invitedBy: BO, memberCount: 2 }] } })
        await act(async () => { setup('/menu') })
        expect(screen.getByRole('link', { name: /Community/ })).toHaveAttribute('href', '/community')
        expect(screen.getByLabelText('1 invites and requests')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /^Family/ })).not.toBeInTheDocument()
    })

    it('the tab shows the invites', async () => {
        api({ ...COMMUNITY_API, 'GET /api/families': { families: [], invites: [{ id: 3, name: 'The Bergs', owner: BO, invitedBy: BO, memberCount: 2 }] } })
        await act(async () => { setup('/community/family') })
        const tabs = screen.getByRole('navigation', { name: 'Parts of the community' })
        expect(within(tabs).getByRole('link', { name: /Family/ })).toHaveAttribute('href', '/community/family')
        expect(screen.getByText('The Bergs')).toBeInTheDocument()
    })

    const MINE = { families: [{ id: 3, name: 'The Bergs', emoji: '🌻', color: 'teal', owner: BO, memberCount: 2 }], invites: [] }

    it('is there for everybody, not only testers', async () => {
        api({ ...COMMUNITY_API, 'GET /api/families': { families: [], invites: [] } })
        await act(async () => { setup('/community/family', { tester: false }) })
        expect(screen.getByRole('link', { name: 'Family' })).toHaveAttribute('href', '/community/family')
        expect(sent('GET', '/api/families')).not.toHaveLength(0)
        expect(apiFetch.mock.calls.some(([url]) => url.startsWith('/api/tester'))).toBe(false)
    })

    it('the menu leads straight into each of my families', async () => {
        api({ 'GET /api/families': MINE })
        await act(async () => { setup('/menu', { tester: false }) })
        const mine = screen.getByRole('list', { name: 'Your families' })
        expect(within(mine).getByRole('link', { name: /The Bergs/ })).toHaveAttribute('href', '/family/3')
    })

    it('so does the people button in the header', async () => {
        api({ 'GET /api/families': MINE, 'GET /api/families/3': FAMILY, 'GET /api/shared-sessions': { sessions: [], invites: [] } })
        await act(async () => { setup('/panel', { tester: false }) })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Together' })) })
        const panel = screen.getByRole('dialog', { name: 'Together' })
        expect(within(panel).getByText('Your families')).toBeInTheDocument()
        await act(async () => { fireEvent.click(within(panel).getByRole('link', { name: /The Bergs/ })) })
        expect(screen.getByTestId('location')).toHaveTextContent('/family/3')
    })

    it('without a family neither shows one', async () => {
        api({ 'GET /api/families': { families: [], invites: [] } })
        await act(async () => { setup('/menu') })
        expect(screen.queryByRole('list', { name: 'Your families' })).not.toBeInTheDocument()
    })

    it('an invite is joined from the list and opens the family', async () => {
        let joined = false
        api({
            'GET /api/families': () => (joined
                ? { families: [{ id: 3, name: 'The Bergs', owner: BO, memberCount: 2 }], invites: [] }
                : { families: [], invites: [{ id: 3, name: 'The Bergs', owner: BO, invitedBy: BO, memberCount: 1 }] }),
            'POST /api/families/3/join': () => { joined = true; return FAMILY },
            'GET /api/families/3': FAMILY,
        })
        await act(async () => { setup('/family') })
        expect(screen.getByText('Invited by Bo · 1 member')).toBeInTheDocument()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Join' })) })
        expect(sent('POST', '/api/families/3/join')).toHaveLength(1)
        expect(screen.getByTestId('location')).toHaveTextContent('/family/3')
        expect(screen.getByRole('heading', { level: 1, name: 'The Bergs' })).toBeInTheDocument()
    })

    it('a new family is started with the friends picked', async () => {
        api({
            'GET /api/families': { families: [], invites: [] },
            'GET /api/friends': [BO],
            'POST /api/families': { ...FAMILY, id: 4, name: 'Flat', isOwner: true },
            'GET /api/families/4': { ...FAMILY, id: 4, name: 'Flat', isOwner: true },
        })
        await act(async () => { setup('/family') })
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Flat ' } })
        fireEvent.click(screen.getByRole('button', { name: /Bo/ }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start a family' })) })
        const [, options] = sent('POST', '/api/families')[0]
        expect(JSON.parse(options.body)).toEqual({ name: 'Flat', friendIds: [2] })
        expect(screen.getByTestId('location')).toHaveTextContent('/family/4')
    })

    it("the family page shows what's coming up and adds an entry", async () => {
        api({
            'GET /api/families/3': FAMILY,
            'POST /api/families/3/tasks': (options) => ({
                ...FAMILY,
                tasks: [{ id: 93, ...JSON.parse(options.body), done: false, addedBy: ME }, ...FAMILY.tasks],
            }),
        })
        await act(async () => { setup('/family/3') })
        const upcoming = screen.getByRole('heading', { name: 'Coming up' }).closest('section')
        expect(within(upcoming).getByText('Grandma visits')).toBeInTheDocument()
        expect(within(upcoming).getByText(/15:00/)).toBeInTheDocument()
        expect(within(upcoming).queryByText('Last week')).not.toBeInTheDocument()
        expect(within(upcoming).queryByText('Already done')).not.toBeInTheDocument()
        expect(within(upcoming).getByRole('link', { name: 'Open calendar →' })).toHaveAttribute('href', '/calendar?cal=family-3')

        fireEvent.change(within(upcoming).getByRole('textbox', { name: 'New entry' }), { target: { value: 'Dinner' } })
        fireEvent.change(within(upcoming).getByLabelText('Due Date'), { target: { value: '2026-10-21' } })
        fireEvent.change(within(upcoming).getByLabelText('Time'), { target: { value: '19:00' } })
        await act(async () => { fireEvent.click(within(upcoming).getByRole('button', { name: 'Add' })) })
        const [, options] = sent('POST', '/api/families/3/tasks')[0]
        expect(JSON.parse(options.body)).toEqual({ name: 'Dinner', due: '2026-10-21', due_time: '19:00' })
        expect(within(upcoming).getByText('Dinner')).toBeInTheDocument()
    })

    it('entries are ticked off, edited and deleted right on the family page', async () => {
        const mine = { id: 94, name: 'Bake a cake', due: apiDate(2026, 10, 22), done: false, addedBy: ME }
        const withMine = { ...FAMILY, tasks: [mine, ...FAMILY.tasks] }
        api({
            'GET /api/families/3': withMine,
            'PATCH /api/families/3/tasks/90': (options) => ({
                ...withMine,
                tasks: withMine.tasks.map(task => (task.id === 90 ? { ...task, ...JSON.parse(options.body) } : task)),
            }),
            'PATCH /api/families/3/tasks/94': (options) => ({
                ...withMine,
                tasks: withMine.tasks.map(task => (task.id === 94 ? { ...task, ...JSON.parse(options.body) } : task)),
            }),
            'DELETE /api/families/3/tasks/94': { ...FAMILY },
        })
        await act(async () => { setup('/family/3') })
        const upcoming = () => screen.getByRole('heading', { name: 'Coming up' }).closest('section')

        // somebody else's entry: editable, but not mine to delete
        fireEvent.click(within(upcoming()).getByRole('button', { name: 'Edit: Grandma visits' }))
        expect(screen.queryByRole('button', { name: 'Delete: Grandma visits' })).not.toBeInTheDocument()
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Grandma and Grandpa visit' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
        const [, edit] = sent('PATCH', '/api/families/3/tasks/90')[0]
        expect(JSON.parse(edit.body)).toMatchObject({ name: 'Grandma and Grandpa visit', due: '2026-10-24', due_time: '15:00', location: 'Home' })
        expect(within(upcoming()).getByText('Grandma and Grandpa visit')).toBeInTheDocument()
        expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument()

        // ticking off takes it out of what's coming up
        await act(async () => { fireEvent.click(within(upcoming()).getByRole('button', { name: 'Mark as done: Bake a cake' })) })
        expect(JSON.parse(sent('PATCH', '/api/families/3/tasks/94')[0][1].body)).toEqual({ done: true })
        expect(within(upcoming()).queryByText('Bake a cake')).not.toBeInTheDocument()
    })

    it('the chat loads, sends, and gets new messages live', async () => {
        api({
            'GET /api/families/3': FAMILY,
            'GET /api/families/3/messages': { messages: [{ id: 1, user: BO, text: 'Hello all', createdAt: apiDate(2026, 10, 18) }], hasMore: false },
            'POST /api/families/3/messages': (options) => ({ id: 2, user: ME, text: JSON.parse(options.body).text, createdAt: new Date().toISOString() }),
        })
        await act(async () => { setup('/family/3') })
        const chat = screen.getByRole('list', { name: 'Chat' })
        expect(within(chat).getByText('Hello all')).toBeInTheDocument()

        fireEvent.change(screen.getByRole('textbox', { name: 'Message the family…' }), { target: { value: 'Hi!' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
        expect(within(chat).getByText('Hi!')).toBeInTheDocument()

        // the same message arriving live too isn't shown twice; another family's isn't shown here
        await serverSends('family:message', { familyId: 3, message: { id: 2, user: ME, text: 'Hi!', createdAt: new Date().toISOString() } })
        await serverSends('family:message', { familyId: 9, message: { id: 5, user: BO, text: 'Elsewhere', createdAt: new Date().toISOString() } })
        await serverSends('family:message', { familyId: 3, message: { id: 3, user: BO, text: 'Dinner at 7', createdAt: new Date().toISOString() } })
        expect(within(chat).getAllByText('Hi!')).toHaveLength(1)
        expect(within(chat).queryByText('Elsewhere')).not.toBeInTheDocument()
        expect(within(chat).getByText('Dinner at 7')).toBeInTheDocument()
    })

    it('loads the family again when it changed, and a new invite pops up', async () => {
        let name = 'The Bergs'
        let invites = []
        api({
            'GET /api/families': () => ({ families: [{ id: 3, name, owner: BO, memberCount: 2 }], invites }),
            'GET /api/families/3': () => ({ ...FAMILY, name }),
        })
        let store
        await act(async () => { store = setup('/family/3') })
        name = 'Bergs & Co'
        invites = [{ id: 7, name: 'Flatmates', owner: BO, invitedBy: BO, memberCount: 3 }]
        await serverSends('family:changed', { familyId: 3 })
        await settle()
        expect(screen.getByRole('heading', { level: 1, name: 'Bergs & Co' })).toBeInTheDocument()
        expect(store.getState().toast.map(toast => toast.text)).toContain('Bo invited you to a family')
    })

    it("a family I'm not in says so", async () => {
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/families/8') throw Object.assign(new Error('Family not found'), { status: 404 })
            return { families: [], invites: [] }
        })
        await act(async () => { setup('/family/8') })
        expect(screen.getByText(/This family doesn't exist/)).toBeInTheDocument()
    })
})

describe('Quidey Family: board, list, who does what, the week', () => {
    const withExtras = (changes = {}) => ({
        ...FAMILY,
        note: null,
        week: { weekStart: '2026-10-19', people: [{ userId: 2, xp: 90, focusMin: 75, streak: 3 }, { userId: 1, xp: 0, focusMin: 0, streak: 0 }] },
        people: [
            { user: BO, status: 'joined', isOwner: true, online: true },
            { user: ME, status: 'joined', isOwner: false, online: true },
        ],
        ...changes,
    })

    it('everybody pins a note to the board', async () => {
        api({
            'GET /api/families/3': withExtras(),
            'PATCH /api/families/3': (options) => withExtras({
                note: { text: JSON.parse(options.body).note, updatedAt: new Date().toISOString(), updatedBy: ME },
            }),
        })
        await act(async () => { setup('/family/3') })
        const board = screen.getByRole('heading', { name: 'Board' }).closest('section')
        expect(within(board).getByText(/Nothing pinned yet/)).toBeInTheDocument()
        fireEvent.click(within(board).getByRole('button', { name: 'Pin something' }))
        fireEvent.change(within(board).getByRole('textbox', { name: 'Board' }), { target: { value: '  Bins out on Tuesday ' } })
        await act(async () => { fireEvent.click(within(board).getByRole('button', { name: 'Save' })) })
        expect(JSON.parse(sent('PATCH', '/api/families/3')[0][1].body)).toEqual({ note: 'Bins out on Tuesday' })
        expect(within(board).getByText('Bins out on Tuesday')).toBeInTheDocument()
        expect(within(board).getByText(/last by Me/)).toBeInTheDocument()
    })

    it('the list holds entries without a day, each with who takes care of it', async () => {
        const item = { id: 95, name: 'Milk', due: null, done: false, addedBy: BO, assignee: null }
        api({
            'GET /api/families/3': withExtras({ tasks: [...FAMILY.tasks, item] }),
            'POST /api/families/3/tasks': (options) => withExtras({
                tasks: [...FAMILY.tasks, item, { id: 96, ...JSON.parse(options.body), due: null, done: false, addedBy: ME, assignee: ME }],
            }),
            'PATCH /api/families/3/tasks/95': (options) => withExtras({
                tasks: [...FAMILY.tasks, { ...item, assignee: JSON.parse(options.body).assignee_id === 1 ? ME : null }],
            }),
        })
        await act(async () => { setup('/family/3') })
        const list = screen.getByRole('heading', { name: 'List' }).closest('section')
        expect(within(list).getByText('Milk')).toBeInTheDocument()
        expect(within(list).getByText('1 open')).toBeInTheDocument()
        // not in "coming up": it has no day
        expect(within(screen.getByRole('heading', { name: 'Coming up' }).closest('section')).queryByText('Milk')).not.toBeInTheDocument()

        await act(async () => { fireEvent.change(within(list).getByRole('combobox', { name: 'Who takes care of it?: Milk' }), { target: { value: '1' } }) })
        expect(JSON.parse(sent('PATCH', '/api/families/3/tasks/95')[0][1].body)).toEqual({ assignee_id: 1 })

        fireEvent.change(within(list).getByRole('textbox', { name: 'Add to the list …' }), { target: { value: 'Bread' } })
        fireEvent.change(within(list).getByRole('combobox', { name: 'Who takes care of it?' }), { target: { value: '1' } })
        await act(async () => { fireEvent.click(within(list).getByRole('button', { name: 'Add' })) })
        expect(JSON.parse(sent('POST', '/api/families/3/tasks')[0][1].body)).toEqual({ name: 'Bread', assignee_id: 1 })
        expect(within(list).getByText('Bread')).toBeInTheDocument()
    })

    it('"only mine" keeps what I take care of; members show online and their week', async () => {
        const forMe = { id: 97, name: 'Pick up Grandma', due: apiDate(2026, 10, 23), done: false, addedBy: BO, assignee: ME }
        api({ 'GET /api/families/3': withExtras({ tasks: [...FAMILY.tasks, forMe] }) })
        await act(async () => { setup('/family/3') })
        const upcoming = screen.getByRole('heading', { name: 'Coming up' }).closest('section')
        expect(within(upcoming).getByText(/for you/)).toBeInTheDocument()
        fireEvent.click(within(upcoming).getByRole('button', { name: 'Only mine' }))
        expect(within(upcoming).getByText('Pick up Grandma')).toBeInTheDocument()
        expect(within(upcoming).queryByText('Grandma visits')).not.toBeInTheDocument()

        const members = screen.getByRole('heading', { name: 'Members' }).closest('section')
        expect(within(members).getByText('Together this week: 1 h 15 min of focus')).toBeInTheDocument()
        const bo = within(members).getByRole('link', { name: 'Bo' }).closest('li')
        expect(within(bo).getByText('online')).toBeInTheDocument()
        expect(within(bo).getByText('1 h 15 min this week')).toBeInTheDocument()
        // I'm not shown as online to myself
        const me = within(members).getByRole('link', { name: 'Me' }).closest('li')
        expect(within(me).queryByText('online')).not.toBeInTheDocument()

        // Bo closes the app
        await serverSends('presence:changed', { userId: 2, online: false })
        expect(within(bo).queryByText('online')).not.toBeInTheDocument()
    })

    it("the owner picks the family's emoji and colour", async () => {
        let mine = withExtras({ isOwner: true, owner: ME })
        api({
            'GET /api/families/3': () => mine,
            'PATCH /api/families/3': (options) => (mine = { ...mine, ...JSON.parse(options.body) }),
        })
        await act(async () => { setup('/family/3') })
        fireEvent.click(screen.getByRole('button', { name: 'Family look' }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '🌻' })) })
        expect(JSON.parse(sent('PATCH', '/api/families/3')[0][1].body)).toEqual({ emoji: '🌻' })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Teal' })) })
        expect(JSON.parse(sent('PATCH', '/api/families/3')[1][1].body)).toEqual({ color: 'teal' })
        expect(screen.getByRole('button', { name: 'Family look' })).toHaveTextContent('🌻')
    })

    it('members who are not the owner see the emoji but cannot change it', async () => {
        api({ 'GET /api/families/3': withExtras({ emoji: '🦊' }) })
        await act(async () => { setup('/family/3') })
        expect(screen.queryByRole('button', { name: 'Family look' })).not.toBeInTheDocument()
        expect(screen.getByText('🦊')).toBeInTheDocument()
    })
})
