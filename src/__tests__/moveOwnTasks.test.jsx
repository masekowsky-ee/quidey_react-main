import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { setLanguage } from '../features/settings/settingsAction'
import { REFRESH_TASKS } from '../features/tasks/taskActionTypes'
import MoveMyTasks from '../components/family/MoveMyTasks'
import ShareMyTasks from '../components/together/ShareMyTasks'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const apiDate = (year, month, day) => new Date(year, month - 1, day).toISOString()
const FRIEND = { id: 2, username: 'bo', displayName: 'Bo' }
const MY_TASKS = [
    { id: 1, name: 'Essay', done: false, kind: 'task', due: apiDate(2026, 10, 22), isOwner: true, sharedWith: [] },
    { id: 2, name: 'Concert', done: false, kind: 'event', due: apiDate(2026, 10, 25), due_time: '20:00', isOwner: true, sharedWith: [] },
    { id: 3, name: 'Gym', done: false, kind: 'task', due: apiDate(2026, 10, 20), repeat: 'weekly', isOwner: true, sharedWith: [] },
    { id: 4, name: 'Shared slides', done: false, kind: 'task', due: null, isOwner: true, sharedWith: [{ shareId: 1, status: 'accepted', user: FRIEND }] },
    { id: 5, name: 'Old done', done: true, kind: 'task', due: null, isOwner: true, sharedWith: [] },
    { id: 6, name: 'Past party', done: true, kind: 'event', due: apiDate(2026, 10, 10), isOwner: true, sharedWith: [] },
    { id: 7, name: 'From Bo', done: false, kind: 'task', due: null, isOwner: false, owner: FRIEND, sharedWith: [] },
]

function setup(ui) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('en'))
    store.dispatch({ type: REFRESH_TASKS, payload: MY_TASKS })
    render(<Provider store={store}><MemoryRouter>{ui}</MemoryRouter></Provider>)
    return store
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 19, 10, 0))
    apiFetch.mockReset()
    apiFetch.mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('moving my own tasks into a family', () => {
    const FAMILY = { id: 3, name: 'The Bergs', me: 1, tasks: [] }

    it('lists my open tasks and coming events, not repeating, shared, done or others\' ones', () => {
        setup(<MoveMyTasks family={FAMILY} onChanged={() => {}} />)
        const card = screen.getByRole('heading', { name: 'From my tasks' }).closest('section')
        expect(within(card).getByText('Essay')).toBeInTheDocument()
        expect(within(card).getByText('Concert')).toBeInTheDocument()
        for (const name of ['Gym', 'Shared slides', 'Old done', 'Past party', 'From Bo']) {
            expect(within(card).queryByText(name)).not.toBeInTheDocument()
        }
    })

    it('asks first, then moves it and loads my tasks again', async () => {
        const moved = { ...FAMILY, tasks: [{ id: 50, name: 'Essay', done: false }] }
        apiFetch.mockImplementation(async (url, options = {}) => {
            if (url === '/api/families/3/tasks' && options.method === 'POST') return moved
            if (url === '/api/tasks') return MY_TASKS.filter(task => task.id !== 1)
            return []
        })
        const onChanged = vi.fn()
        const store = setup(<MoveMyTasks family={FAMILY} subGroup={7} onChanged={onChanged} />)
        fireEvent.click(screen.getByRole('button', { name: 'Move into the family: Essay' }))
        const dialog = screen.getByRole('alertdialog')
        expect(within(dialog).getByText(/It leaves your list/)).toBeInTheDocument()
        expect(apiFetch).not.toHaveBeenCalledWith('/api/families/3/tasks', expect.anything())

        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Move' })) })
        const call = apiFetch.mock.calls.find(([url, o]) => url === '/api/families/3/tasks' && o?.method === 'POST')
        expect(JSON.parse(call[1].body)).toEqual({ taskId: 1, group_id: 7 })
        expect(onChanged).toHaveBeenCalledWith(moved)
        expect(apiFetch).toHaveBeenCalledWith('/api/tasks')
        expect(store.getState().task.tasks.some(task => task.id === 1)).toBe(false)
        expect(store.getState().toast.some(toast => toast.text === 'Moved into the family')).toBe(true)
    })

    it('cancelling moves nothing', async () => {
        setup(<MoveMyTasks family={FAMILY} onChanged={() => {}} />)
        fireEvent.click(screen.getByRole('button', { name: 'Move into the family: Concert' }))
        await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' })) })
        expect(apiFetch.mock.calls.some(([url, o]) => url === '/api/families/3/tasks' && o?.method === 'POST')).toBe(false)
    })
})

describe('sharing my own tasks into a session', () => {
    it('lists coming own events too, marked as events; past ones not', async () => {
        const session = { id: 5, name: 'Study group', endedAt: null, tasks: [] }
        setup(<ShareMyTasks session={session} />)
        const card = screen.getByRole('heading', { name: 'My tasks' }).closest('section')
        const concert = within(card).getByText('Concert').closest('li')
        expect(within(concert).getByText(/^Event ·/)).toBeInTheDocument()
        expect(within(card).queryByText('Past party')).not.toBeInTheDocument()
        await act(async () => { fireEvent.click(within(concert).getByRole('button', { name: 'Share' })) })
        const call = apiFetch.mock.calls.find(([url, o]) => url === '/api/shared-sessions/5/tasks' && o?.method === 'POST')
        expect(JSON.parse(call[1].body)).toEqual({ taskId: 2 })
    })
})
