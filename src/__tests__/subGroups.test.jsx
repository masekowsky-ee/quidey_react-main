import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE, EDIT_DISPLAYGROUP } from '../features/tasks/taskActionTypes'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { SET_MY_SHARED_TASKS } from '../features/together/togetherActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import { selectSharedGroups } from '../features/together/togetherAction'
import { createdText } from '../features/tasks/created'
import { inSubGroup, openCounts, shownSubGroup } from '../features/tasks/subGroups'
import translations from '../i18n/translations'
import TaskForm from '../components/TaskForm'
import SharedTaskList from '../components/together/SharedTaskList'
import FamilyPage from '../components/family/FamilyPage'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const t = (key) => translations.en[key] ?? key
const lena = { id: 1, username: 'lena', displayName: 'Lena' }
const ben = { id: 2, username: 'ben', displayName: 'Ben' }

const postTo = (path) => apiFetch.mock.calls.find(([url, options]) => url === path && options?.method === 'POST')
const bodyOf = (path) => {
    const call = postTo(path)
    return call && JSON.parse(call[1].body)
}

function makeStore({ isTester = false } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('en'))
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester, adminPendingCount: 0, betaRequest: null } })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [], groups: [], notes: [] } })
    store.dispatch({ type: SET_MY_SHARED_TASKS, payload: [{ id: 5, name: 'Lerngruppe', me: 1, groups: [{ id: 7, name: 'Kapitel 1' }], tasks: [] }] })
    return store
}

// Home shows the session's group (and maybe one of its sub-groups)
function showSession(store, subGroupId) {
    const [group] = selectSharedGroups(store.getState())
    store.dispatch({ type: EDIT_DISPLAYGROUP, payload: { group: { ...group, subGroupId }, tasks: [] } })
}

function wrap(ui, store, path = '/') {
    return render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
        </Provider>
    )
}

const session = (overrides = {}) => ({
    id: 5, name: 'Lerngruppe', me: 1, isOwner: true, endedAt: null, receivedAt: Date.now(),
    people: [{ user: lena, status: 'joined', isOwner: true, workingOn: null, totalMs: 0 }],
    events: [],
    groups: [{ id: 7, name: 'Kapitel 1' }, { id: 8, name: 'Kapitel 2' }],
    tasks: [
        { id: 20, name: 'Lesen', done: false, groupId: 7, addedBy: ben, createdAt: '2026-10-20T12:05:00Z', assignee: null, time: [], totalMs: 0 },
        { id: 21, name: 'Folien', done: false, groupId: 8, addedBy: lena, createdAt: '2026-10-21T08:00:00Z', assignee: null, time: [], totalMs: 0 },
        { id: 22, name: 'Lose', done: false, groupId: null, addedBy: null, createdAt: null, assignee: null, time: [], totalMs: 0 },
    ],
    ...overrides,
})

beforeEach(() => {
    apiFetch.mockReset()
    apiFetch.mockResolvedValue([])
    localStorage.clear()
})

describe('when and by whom an entry was made', () => {
    const at = '2026-10-26T13:03:00Z'

    it('my own task is mine; one shared with me is the friend’s', () => {
        expect(createdText({ created_at: at, owner: null }, t, 'en', 'lena')).toMatch(/^Created on 26 Oct 2026 at \d\d:03 by you$/)
        expect(createdText({ created_at: at, owner: ben }, t, 'en', 'lena')).toMatch(/at \d\d:03 by Ben$/)
    })

    it('a session’s or family’s entry names who added it, or nobody when the account is gone', () => {
        expect(createdText({ createdAt: at, addedBy: lena }, t, 'en', 'lena')).toMatch(/by you$/)
        expect(createdText({ createdAt: at, addedBy: ben }, t, 'en', 'lena')).toMatch(/by Ben$/)
        expect(createdText({ createdAt: at, addedBy: null }, t, 'en', 'lena')).toMatch(/^Created on 26 Oct 2026 at \d\d:03$/)
    })

    it('says nothing without a time', () => {
        expect(createdText({ name: 'old', addedBy: ben }, t, 'en', 'lena')).toBe('')
        expect(createdText({ created_at: 'nonsense' }, t, 'en', 'lena')).toBe('')
    })
})

describe('sub-group helpers', () => {
    const entries = [{ groupId: 7, done: false }, { groupId: 7, done: true }, { groupId: null, done: false }]
    it('filter, count open entries, and forget a group that is gone', () => {
        expect(inSubGroup(entries, null)).toHaveLength(3)
        expect(inSubGroup(entries, 7)).toHaveLength(2)
        expect(openCounts(entries)).toEqual({ all: 2, 7: 1 })
        expect(shownSubGroup([{ id: 7 }], 7)).toBe(7)
        expect(shownSubGroup([{ id: 7 }], 9)).toBeNull()
    })
})

describe('a new task while a session’s group is shown on Home', () => {
    const create = async (name) => {
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: name } })
        apiFetch.mockResolvedValueOnce(session())
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })) })
    }

    it('goes into the session, not into my own list', async () => {
        const store = makeStore()
        showSession(store)
        const setCreateTask = vi.fn()
        wrap(<TaskForm setCreateTask={setCreateTask} />, store)
        expect(screen.getByText(/Goes into the session “Lerngruppe”/)).toBeInTheDocument()
        // nothing personal: no sharing with friends
        fireEvent.click(screen.getByRole('button', { name: /More options/ }))
        expect(screen.queryByText(t('shareWithFriends'))).toBeNull()

        await create('Zusammenfassung')
        expect(bodyOf('/api/shared-sessions/5/tasks')).toMatchObject({ name: 'Zusammenfassung', kind: 'task' })
        expect(bodyOf('/api/shared-sessions/5/tasks')).not.toHaveProperty('group_id')
        expect(postTo('/api/tasks')).toBeUndefined()
        expect(setCreateTask).toHaveBeenCalledWith(false)
    })

    it('for a tester, into the shown sub-group too', async () => {
        const store = makeStore({ isTester: true })
        showSession(store, 7)
        wrap(<TaskForm setCreateTask={vi.fn()} />, store)
        expect(screen.getByText(/“Lerngruppe · Kapitel 1”/)).toBeInTheDocument()
        await create('Kapitel lesen')
        expect(bodyOf('/api/shared-sessions/5/tasks')).toMatchObject({ name: 'Kapitel lesen', group_id: 7 })
    })

    it('opened on another page, it stays my own task', async () => {
        const store = makeStore()
        showSession(store)
        wrap(<TaskForm setCreateTask={vi.fn()} />, store, '/calendar')
        expect(screen.queryByText(/Goes into the session/)).toBeNull()
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Eigenes' } })
        apiFetch.mockResolvedValueOnce({ id: 40, name: 'Eigenes' })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })) })
        expect(bodyOf('/api/tasks')).toMatchObject({ name: 'Eigenes' })
        expect(postTo('/api/shared-sessions/5/tasks')).toBeUndefined()
    })
})

describe('sub-groups in a family', () => {
    const family = {
        id: 3, name: 'WG', me: 1, isOwner: true, owner: lena, createdAt: '2026-10-01T10:00:00Z',
        people: [{ user: lena, status: 'joined', isOwner: true }, { user: ben, status: 'joined', isOwner: false }],
        groups: [{ id: 4, name: 'Einkauf' }],
        tasks: [
            { id: 30, name: 'Milch', due: null, done: false, groupId: 4, addedBy: ben, createdAt: '2026-10-25T09:30:00Z' },
            { id: 31, name: 'Bad putzen', due: null, done: false, groupId: null, addedBy: lena, createdAt: '2026-10-25T10:00:00Z' },
        ],
    }
    const open = async (isTester) => {
        // changes answer with the whole family
        apiFetch.mockImplementation(async (url) => (url.endsWith('/messages') ? { messages: [], hasMore: false } : family))
        wrap(<Routes><Route path="/family/:id" element={<FamilyPage />} /></Routes>, makeStore({ isTester }), '/family/3')
        await screen.findByText('Milch')
    }

    it('a tester picks one: the list shows its entries and new ones go into it', async () => {
        await open(true)
        expect(screen.getByText('Milch').closest('li')).toHaveAttribute('title', expect.stringMatching(/by Ben$/))
        fireEvent.click(within(screen.getByRole('group', { name: 'Sub-groups' })).getByRole('button', { name: /Einkauf/ }))
        expect(screen.queryByText('Bad putzen')).toBeNull()

        fireEvent.change(screen.getByRole('textbox', { name: t('familyListAdd') }), { target: { value: 'Brot' } })
        await act(async () => { fireEvent.submit(screen.getByRole('textbox', { name: t('familyListAdd') })) })
        expect(bodyOf('/api/families/3/tasks')).toEqual({ name: 'Brot', group_id: 4 })
    })

    it('everybody else sees the whole list as before', async () => {
        await open(false)
        expect(screen.queryByRole('group', { name: 'Sub-groups' })).toBeNull()
        expect(screen.getByText('Bad putzen')).toBeInTheDocument()
    })
})

describe('sub-groups in a session’s task list', () => {
    it('only testers see them; everybody sees every task and who made it when', () => {
        wrap(<SharedTaskList session={session()} />, makeStore())
        expect(screen.queryByRole('group', { name: 'Sub-groups' })).toBeNull()
        expect(screen.getByText('Lesen')).toBeInTheDocument()
        expect(screen.getByText('Lose')).toBeInTheDocument()
        expect(screen.getByText('Lesen').closest('li')).toHaveAttribute('title', expect.stringMatching(/^Created on 20 Oct 2026 at .* by Ben$/))
        expect(screen.getByText('Folien').closest('li')).toHaveAttribute('title', expect.stringMatching(/by you$/))
        expect(screen.getByText('Lose').closest('li')).not.toHaveAttribute('title')
    })

    it('a tester filters by one, adds into it and makes new ones', async () => {
        wrap(<SharedTaskList session={session()} />, makeStore({ isTester: true }))
        const bar = screen.getByRole('group', { name: 'Sub-groups' })
        fireEvent.click(within(bar).getByRole('button', { name: /Kapitel 1/ }))
        expect(screen.getByText('Lesen')).toBeInTheDocument()
        expect(screen.queryByText('Folien')).toBeNull()
        expect(screen.queryByText('Lose')).toBeNull()

        fireEvent.change(screen.getByRole('textbox', { name: t('newSharedTask') }), { target: { value: 'Notizen' } })
        apiFetch.mockResolvedValueOnce(session())
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: t('add') })) })
        expect(bodyOf('/api/shared-sessions/5/tasks')).toEqual({ name: 'Notizen', group_id: 7 })

        fireEvent.click(within(bar).getByRole('button', { name: 'New sub-group' }))
        fireEvent.change(screen.getByRole('textbox', { name: 'Sub-group name' }), { target: { value: 'Kapitel 3' } })
        apiFetch.mockResolvedValueOnce(session())
        await act(async () => { fireEvent.submit(screen.getByRole('textbox', { name: 'Sub-group name' })) })
        expect(bodyOf('/api/tester/shared-sessions/5/groups')).toEqual({ name: 'Kapitel 3' })
    })
})
