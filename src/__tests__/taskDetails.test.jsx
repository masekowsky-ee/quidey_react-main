import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE, SET_TASK_INVITES, EDIT_DISPLAYGROUP } from '../features/tasks/taskActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import {
    addTask, updateTaskProps, shareTask, acceptTaskInvite, declineTaskInvite, leaveTask, unshareTask, refreshTasks,
} from '../features/tasks/taskAction'
import {
    minutesOfDay, taskTimeText, durationText, taskStart, compareTasks, filterTasks, toIcs,
} from '../features/calendar/calendar'
import { reminderAt, dueReminders, reminderKey } from '../features/tasks/reminders'
import { linkIsValid } from '../features/tasks/taskFields'
import { taskColorAttr } from '../features/tasks/taskColors'
import { useAccountLocale } from '../features/settings/accountLocale'
import Calendar from '../components/Calendar'
import TaskForm from '../components/TaskForm'
import TaskInvites from '../components/task/TaskInvites'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const apiDate = (year, month, day) => new Date(year, month - 1, day).toISOString()
const bodyOf = (path, method) => {
    const call = apiFetch.mock.calls.find(([url, options]) => url === path && (!method || options?.method === method))
    return call && JSON.parse(call[1].body)
}

const BOB = { id: 2, username: 'bob', displayName: 'Bob' }
const ALICE = { id: 1, username: 'alice', displayName: 'Alice' }

function makeStore(tasks = [], extra = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('en'))
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks, groups: [], notes: [] } })
    if (extra.invites) store.dispatch({ type: SET_TASK_INVITES, payload: extra.invites })
    if (extra.friends) store.dispatch({ type: 'SET_FRIENDS', payload: extra.friends })
    return store
}

beforeEach(() => {
    apiFetch.mockReset()
    apiFetch.mockResolvedValue([])
    localStorage.clear()
})

describe('time of day', () => {
    const task = { due: apiDate(2026, 10, 20), due_time: '23:30', duration_minutes: 90 }

    it('reads and shows times and durations', () => {
        expect(minutesOfDay('09:05')).toBe(545)
        expect(minutesOfDay(null)).toBeNull()
        expect(taskTimeText(task)).toBe('23:30–01:00')
        expect(taskTimeText({ due_time: '08:00' })).toBe('08:00')
        expect(taskTimeText({ due_time: null })).toBe('')
        expect(durationText(90)).toBe('1 h 30 min')
        expect(durationText(1440)).toBe('1 d')
        const start = taskStart(task)
        expect([start.getDate(), start.getHours(), start.getMinutes()]).toEqual([20, 23, 30])
        expect(taskStart({ due: apiDate(2026, 10, 20) })).toBeNull()
    })

    it('sorts whole-day tasks first, then by time', () => {
        const tasks = [
            { name: 'late', due_time: '18:00', prio: 99 },
            { name: 'all day', due_time: null, prio: 0 },
            { name: 'early', due_time: '08:15', prio: 0 },
            { name: 'done early', due_time: '07:00', done: true },
        ]
        expect(tasks.sort(compareTasks).map(t => t.name)).toEqual(['all day', 'early', 'late', 'done early'])
    })

    it('search also finds the location and extra info', () => {
        const tasks = [{ id: 1, name: 'Lunch', location: 'Luigi', details: 'table 4' }, { id: 2, name: 'Other' }]
        expect(filterTasks(tasks, { query: 'luigi' }).map(t => t.id)).toEqual([1])
        expect(filterTasks(tasks, { query: 'TABLE' }).map(t => t.id)).toEqual([1])
    })

    it('only http(s) links are valid', () => {
        expect(linkIsValid('')).toBe(true)
        expect(linkIsValid('https://example.com/a')).toBe(true)
        expect(linkIsValid('javascript:alert(1)')).toBe(false)
        expect(linkIsValid('example.com')).toBe(false)
    })
})

describe('iCalendar export with times', () => {
    it('writes start and end, location, link and the reminder', () => {
        const ics = toIcs([{
            id: 3, name: 'Lunch', due: apiDate(2026, 10, 22), due_time: '12:30', duration_minutes: 90,
            reminder_minutes: 15, location: 'Luigi, Main St', link: 'https://example.com/', details: 'Table 4',
        }], { now: new Date(Date.UTC(2026, 9, 19)) })
        const lines = ics.split('\r\n')
        expect(lines).toContain('DTSTART:20261022T123000')
        expect(lines).toContain('DTEND:20261022T140000')
        expect(lines).toContain('LOCATION:Luigi\\, Main St')
        expect(lines).toContain('URL:https://example.com/')
        expect(lines).toContain('DESCRIPTION:Table 4')
        expect(lines).toContain('TRIGGER:-PT15M')
    })

    it('a timed task without a duration lasts 30 minutes, done ones get no alarm', () => {
        const ics = toIcs([{ id: 4, name: 'Call', due: '2026-10-22', due_time: '23:45', reminder_minutes: 5, done: true }])
        expect(ics).toContain('DTEND:20261023T001500')
        expect(ics).not.toContain('VALARM')
    })
})

describe('reminders', () => {
    const task = { id: 7, name: 'Lunch', due: apiDate(2026, 10, 22), due_time: '12:30', reminder_minutes: 15, done: false }

    it('are due from the reminder time until an hour after the start', () => {
        expect(reminderAt(task)).toEqual(new Date(2026, 9, 22, 12, 15))
        const none = new Set()
        expect(dueReminders([task], new Date(2026, 9, 22, 12, 14), none)).toEqual([])
        expect(dueReminders([task], new Date(2026, 9, 22, 12, 15), none)).toEqual([task])
        expect(dueReminders([task], new Date(2026, 9, 22, 13, 29), none)).toEqual([task])
        expect(dueReminders([task], new Date(2026, 9, 22, 13, 31), none)).toEqual([])
    })

    it('show once, but again after the time was changed', () => {
        const shown = new Set([reminderKey(task)])
        expect(dueReminders([task], new Date(2026, 9, 22, 12, 20), shown)).toEqual([])
        const moved = { ...task, due_time: '12:35' }
        expect(dueReminders([moved], new Date(2026, 9, 22, 12, 21), shown)).toEqual([moved])
    })

    it('none without a time, without a reminder, or when done', () => {
        expect(reminderAt({ ...task, due_time: null })).toBeNull()
        expect(reminderAt({ ...task, reminder_minutes: null })).toBeNull()
        expect(reminderAt({ ...task, done: true })).toBeNull()
        expect(reminderAt({ ...task, reminder_minutes: 0 })).toEqual(new Date(2026, 9, 22, 12, 30))
    })
})

describe('task actions', () => {
    const shared = { id: 5, name: 'Lunch', due: apiDate(2026, 10, 22), due_time: '12:30', location: 'Luigi', prio: 50, done: false, isOwner: true, sharedWith: [] }

    it('addTask sends the optional fields', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValueOnce({ id: 9, name: 'x', due_time: '09:00' })
        const task = await store.dispatch(addTask('x', '2026-10-22', '', 50, null, undefined, { due_time: '09:00', location: '' }))
        expect(bodyOf('/api/tasks')).toMatchObject({ due_time: '09:00', location: null })
        expect(task.id).toBe(9)
    })

    it('updateTaskProps keeps the details and drops the time with the day', async () => {
        const store = makeStore([shared])
        apiFetch.mockResolvedValueOnce({ ...shared, done: true })
        await store.dispatch(updateTaskProps({ done: true }, shared))
        expect(bodyOf('/api/tasks/5')).toMatchObject({ due_time: '12:30', location: 'Luigi', done: true })

        apiFetch.mockClear()
        apiFetch.mockResolvedValueOnce({ ...shared, due: null, due_time: null })
        await store.dispatch(updateTaskProps({ due: '' }, shared))
        expect(bodyOf('/api/tasks/5')).toMatchObject({ due: null, due_time: null })
        expect(store.getState().task.tasks[0].due_time).toBeNull()
    })

    it('shareTask stores who it was sent to; unshareTask takes one back', async () => {
        const store = makeStore([shared])
        apiFetch.mockResolvedValueOnce({ ...shared, sharedWith: [{ shareId: 11, status: 'pending', user: BOB }] })
        await store.dispatch(shareTask(5, [2]))
        expect(apiFetch).toHaveBeenCalledWith('/api/tasks/5/shares', { method: 'POST', body: JSON.stringify({ userIds: [2] }) })
        expect(store.getState().task.tasks[0].sharedWith).toHaveLength(1)

        apiFetch.mockResolvedValueOnce({ id: 11 })
        await store.dispatch(unshareTask(5, 11))
        expect(apiFetch).toHaveBeenLastCalledWith('/api/task-shares/11', { method: 'DELETE' })
        expect(store.getState().task.tasks[0].sharedWith).toEqual([])
    })

    it('accepting an invite adds the task, declining drops the invite', async () => {
        const invite = { id: 3, from: ALICE, task: { id: 8, name: 'From Alice' } }
        const store = makeStore([], { invites: [invite, { ...invite, id: 4 }] })
        apiFetch.mockResolvedValueOnce({ id: 8, name: 'From Alice', isOwner: false, owner: ALICE, shareId: 3 })
        await store.dispatch(acceptTaskInvite(3))
        expect(store.getState().task.tasks.map(t => t.id)).toEqual([8])
        expect(store.getState().task.groupToDisplay.tasks.map(t => t.id)).toEqual([8])
        expect(store.getState().task.invites.map(i => i.id)).toEqual([4])

        apiFetch.mockResolvedValueOnce({ id: 4 })
        await store.dispatch(declineTaskInvite(4))
        expect(store.getState().task.invites).toEqual([])
    })

    it('leaving a shared task removes it from my list', async () => {
        const fromAlice = { id: 8, name: 'From Alice', isOwner: false, owner: ALICE, shareId: 3 }
        const store = makeStore([fromAlice])
        apiFetch.mockResolvedValueOnce({ id: 3 })
        await store.dispatch(leaveTask(fromAlice))
        expect(apiFetch).toHaveBeenCalledWith('/api/task-shares/3', { method: 'DELETE' })
        expect(store.getState().task.tasks).toEqual([])
    })

    it('refreshTasks takes the new values and keeps the shown group', async () => {
        const store = makeStore([{ id: 1, name: 'a' }, { id: 2, name: 'b' }])
        store.dispatch({ type: EDIT_DISPLAYGROUP, payload: { group: { id: 10, name: 'Work' }, tasks: [{ id: 2, name: 'b' }] } })
        apiFetch.mockResolvedValueOnce([{ id: 1, name: 'a' }, { id: 2, name: 'b changed', due_time: '10:00' }])
        await store.dispatch(refreshTasks())
        expect(store.getState().task.tasks[1].name).toBe('b changed')
        expect(store.getState().task.groupToDisplay.tasks).toEqual([{ id: 2, name: 'b changed', due_time: '10:00' }])
    })
})

describe('calendar with times and sharing', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(2026, 9, 19, 10, 0))
    })
    afterEach(() => vi.useRealTimers())

    const lunch = { id: 5, name: 'Lunch', due: apiDate(2026, 10, 22), due_time: '12:30', duration_minutes: 90, location: 'Luigi', prio: 50, done: false, isOwner: true, sharedWith: [{ shareId: 11, status: 'accepted', user: BOB }], group_ids: [] }
    const fromAlice = { id: 6, name: 'Movie night', due: apiDate(2026, 10, 22), prio: 20, done: false, isOwner: false, owner: ALICE, shareId: 3, sharedWith: [], group_ids: [] }

    const renderCalendar = (path, store) => render(
        <Provider store={store}><MemoryRouter initialEntries={[path]}><Calendar /></MemoryRouter></Provider>
    )

    it('shows the time on the chip, sorted after whole-day tasks', () => {
        renderCalendar('/calendar?date=2026-10-22', makeStore([lunch, fromAlice]))
        const day = document.querySelector('[data-date="2026-10-22"]')
        const chips = within(day).getAllByRole('button').map(b => b.textContent)
        expect(chips[0]).toContain('Movie night')
        expect(chips[1]).toContain('12:30')
        expect(chips[1]).toContain('Lunch')
    })

    it('the day panel shows time range, location and who it is shared with', () => {
        renderCalendar('/calendar?date=2026-10-22&day=2026-10-22', makeStore([lunch, fromAlice]))
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByText('12:30–14:00')).toBeInTheDocument()
        expect(within(dialog).getByText('Luigi')).toBeInTheDocument()
        expect(within(dialog).getByText('Bob')).toBeInTheDocument()
        expect(within(dialog).getByText('From Alice')).toBeInTheDocument()
    })

    it('adds a task with a time from the day panel', async () => {
        const store = makeStore([])
        renderCalendar('/calendar?date=2026-10-22&day=2026-10-22', store)
        apiFetch.mockResolvedValueOnce({ id: 20, name: 'Gym', due: apiDate(2026, 10, 22), due_time: '18:00' })
        fireEvent.change(screen.getByRole('textbox', { name: 'New task for this day…' }), { target: { value: 'Gym' } })
        fireEvent.change(screen.getByLabelText(/^Time/), { target: { value: '18:00' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })) })
        expect(bodyOf('/api/tasks', 'POST')).toMatchObject({ name: 'Gym', due: '2026-10-22', due_time: '18:00' })
    })

    it('edits time, duration, location and reminder', async () => {
        const store = makeStore([{ ...lunch, sharedWith: [] }])
        renderCalendar('/calendar?date=2026-10-22&day=2026-10-22&task=5', store)
        // opened from the address straight into the editor; the options start closed, with a summary
        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Lunch')
        const toggle = screen.getByRole('button', { name: /More options/ })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(toggle).toHaveTextContent('1 h 30 min · Luigi')
        expect(screen.queryByRole('combobox', { name: 'Duration' })).not.toBeInTheDocument()
        fireEvent.click(toggle)
        fireEvent.change(screen.getByLabelText('Time'), { target: { value: '13:00' } })
        fireEvent.change(screen.getByRole('combobox', { name: 'Duration' }), { target: { value: '60' } })
        fireEvent.change(screen.getByRole('combobox', { name: 'Reminder' }), { target: { value: '15' } })
        fireEvent.change(screen.getByRole('textbox', { name: 'Location' }), { target: { value: 'Pizza place' } })
        apiFetch.mockResolvedValueOnce({ ...lunch, due_time: '13:00', duration_minutes: 60, reminder_minutes: 15, location: 'Pizza place' })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
        expect(bodyOf('/api/tasks/5', 'PUT')).toMatchObject({ due_time: '13:00', duration_minutes: 60, reminder_minutes: 15, location: 'Pizza place' })
    })

    it('refuses a link that is not http(s)', async () => {
        renderCalendar('/calendar?date=2026-10-22&day=2026-10-22&task=5', makeStore([lunch]))
        fireEvent.click(screen.getByRole('button', { name: /More options/ }))
        fireEvent.change(screen.getByRole('textbox', { name: 'Link' }), { target: { value: 'javascript:alert(1)' } })
        expect(screen.getByText(/http:\/\/ or https:\/\//)).toBeInTheDocument()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
        expect(apiFetch.mock.calls.some(([url]) => url === '/api/tasks/5')).toBe(false)
    })

    it('a task shared with me can be left, not deleted', async () => {
        const store = makeStore([fromAlice])
        renderCalendar('/calendar?date=2026-10-22&day=2026-10-22', store)
        fireEvent.click(screen.getByRole('button', { name: 'Edit: Movie night' }))
        expect(screen.queryByRole('button', { name: 'Delete: Movie night' })).not.toBeInTheDocument()
        expect(screen.getByText(/Shared by Alice/)).toBeInTheDocument()
        apiFetch.mockResolvedValueOnce({ id: 3 })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Leave' })) })
        expect(apiFetch).toHaveBeenCalledWith('/api/task-shares/3', { method: 'DELETE' })
        expect(store.getState().task.tasks).toEqual([])
    })

    it('the owner invites a friend from the editor', async () => {
        const store = makeStore([{ ...lunch, sharedWith: [] }], { friends: [BOB] })
        renderCalendar('/calendar?date=2026-10-22&day=2026-10-22&task=5', store)
        fireEvent.click(screen.getByRole('button', { name: /More options/ }))
        fireEvent.click(screen.getByRole('button', { name: /Bob/ }))
        apiFetch.mockResolvedValueOnce({ ...lunch, sharedWith: [{ shareId: 12, status: 'pending', user: BOB }] })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Invite' })) })
        expect(bodyOf('/api/tasks/5/shares')).toEqual({ userIds: [2] })
        expect(screen.getByText('invited')).toBeInTheDocument()
    })
})

describe('invites', () => {
    it('lists tasks friends sent and accepts one', async () => {
        const invite = { id: 3, createdAt: '2026-10-19T10:00:00Z', from: ALICE, task: { id: 8, name: 'Movie night', due: apiDate(2026, 10, 24), due_time: '20:00', location: 'Cinema' } }
        const store = makeStore([], { invites: [invite] })
        render(<Provider store={store}><MemoryRouter><TaskInvites /></MemoryRouter></Provider>)
        expect(screen.getByText('Alice wants to share this task with you')).toBeInTheDocument()
        expect(screen.getByText('20:00')).toBeInTheDocument()
        expect(screen.getByText('Cinema')).toBeInTheDocument()
        apiFetch.mockResolvedValueOnce({ id: 8, name: 'Movie night', owner: ALICE, isOwner: false, shareId: 3 })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Accept' })) })
        expect(apiFetch).toHaveBeenCalledWith('/api/task-shares/3/accept', { method: 'POST' })
        expect(store.getState().task.tasks).toHaveLength(1)
        expect(screen.queryByText('Movie night')).not.toBeInTheDocument()
    })
})

describe('create task form', () => {
    it('creates a task with time and options and invites friends', async () => {
        const store = makeStore([], { friends: [BOB] })
        const setCreateTask = vi.fn()
        render(<Provider store={store}><MemoryRouter><TaskForm setCreateTask={setCreateTask} /></MemoryRouter></Provider>)
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Lunch' } })
        fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-10-22' } })
        fireEvent.change(screen.getByLabelText(/^Time/), { target: { value: '12:30' } })
        fireEvent.click(screen.getByRole('button', { name: /More options/ }))
        fireEvent.change(screen.getByRole('textbox', { name: 'Location' }), { target: { value: 'Luigi' } })
        fireEvent.change(screen.getByRole('combobox', { name: 'Duration' }), { target: { value: '90' } })
        fireEvent.click(screen.getByRole('button', { name: /Bob/ }))
        apiFetch
            .mockResolvedValueOnce({ id: 30, name: 'Lunch' })
            .mockResolvedValueOnce({ id: 30, name: 'Lunch', sharedWith: [{ shareId: 1, status: 'pending', user: BOB }] })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })) })
        expect(bodyOf('/api/tasks')).toMatchObject({ name: 'Lunch', due: '2026-10-22', due_time: '12:30', duration_minutes: 90, location: 'Luigi', prio: null })
        expect(bodyOf('/api/tasks/30/shares')).toEqual({ userIds: [2] })
        expect(setCreateTask).toHaveBeenCalledWith(false)
    })

    it('only the name is needed: no day, no priority', async () => {
        const setCreateTask = vi.fn()
        render(<Provider store={makeStore()}><MemoryRouter><TaskForm setCreateTask={setCreateTask} /></MemoryRouter></Provider>)
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Read' } })
        apiFetch.mockResolvedValueOnce({ id: 31, name: 'Read' })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })) })
        expect(bodyOf('/api/tasks')).toMatchObject({ name: 'Read', due: null, prio: null, due_time: null })
        expect(setCreateTask).toHaveBeenCalledWith(false)
    })

    it('a reminder needs a time', () => {
        render(<Provider store={makeStore()}><MemoryRouter><TaskForm setCreateTask={() => {}} /></MemoryRouter></Provider>)
        fireEvent.click(screen.getByRole('button', { name: /More options/ }))
        expect(screen.getByRole('combobox', { name: 'Reminder' })).toBeDisabled()
        // a time needs a day first
        expect(screen.getByLabelText(/^Time/)).toBeDisabled()
        fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-10-22' } })
        fireEvent.change(screen.getByLabelText(/^Time/), { target: { value: '09:00' } })
        expect(screen.getByRole('combobox', { name: 'Reminder' })).toBeEnabled()
    })
})

describe('task colours and reminders by mail', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(2026, 9, 19, 10, 0))
    })
    afterEach(() => vi.useRealTimers())

    const lunch = { id: 5, name: 'Lunch', due: apiDate(2026, 10, 22), due_time: '12:30', reminder_minutes: 15, prio: 50, done: false, isOwner: true, sharedWith: [], group_ids: [] }
    const renderCalendar = (path, store) => render(
        <Provider store={store}><MemoryRouter initialEntries={[path]}><Calendar /></MemoryRouter></Provider>
    )

    it('only open tasks with a known colour get one', () => {
        expect(taskColorAttr({ color: 'teal', done: false })).toBe('teal')
        expect(taskColorAttr({ color: 'teal', done: true })).toBeUndefined()
        expect(taskColorAttr({ color: 'chartreuse' })).toBeUndefined()
        expect(taskColorAttr({ color: null })).toBeUndefined()
    })

    it('the calendar chip carries the colour', () => {
        renderCalendar('/calendar?date=2026-10-22', makeStore([{ ...lunch, color: 'violet' }]))
        const chip = within(document.querySelector('[data-date="2026-10-22"]')).getByRole('button', { name: /Lunch/ })
        expect(chip).toHaveAttribute('data-task-color', 'violet')
    })

    it('the editor changes the colour and turns on the mail reminder', async () => {
        renderCalendar('/calendar?date=2026-10-22&day=2026-10-22&task=5', makeStore([lunch]))
        fireEvent.click(screen.getByRole('radio', { name: 'Blue' }))
        fireEvent.click(screen.getByRole('button', { name: /More options/ }))
        fireEvent.click(screen.getByRole('checkbox', { name: 'Also remind me by email' }))
        apiFetch.mockResolvedValueOnce({ ...lunch, color: 'blue', reminder_email: true })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
        expect(bodyOf('/api/tasks/5', 'PUT')).toMatchObject({ color: 'blue', reminder_email: true, reminder_minutes: 15 })
    })

    it('the mail switch needs a reminder and is only for the owner', () => {
        const { unmount } = renderCalendar('/calendar?date=2026-10-22&day=2026-10-22&task=5', makeStore([{ ...lunch, reminder_minutes: null }]))
        fireEvent.click(screen.getByRole('button', { name: /More options/ }))
        expect(screen.queryByRole('checkbox', { name: 'Also remind me by email' })).not.toBeInTheDocument()
        fireEvent.change(screen.getByRole('combobox', { name: 'Reminder' }), { target: { value: '30' } })
        expect(screen.getByRole('checkbox', { name: 'Also remind me by email' })).not.toBeChecked()
        unmount()

        renderCalendar('/calendar?date=2026-10-22&day=2026-10-22&task=5', makeStore([{ ...lunch, isOwner: false, owner: ALICE, shareId: 3 }]))
        fireEvent.click(screen.getByRole('button', { name: /More options/ }))
        expect(screen.queryByRole('checkbox', { name: 'Also remind me by email' })).not.toBeInTheDocument()
    })

    it('a new task gets its colour, and the mail reminder only with a reminder', async () => {
        render(<Provider store={makeStore()}><MemoryRouter><TaskForm setCreateTask={() => {}} /></MemoryRouter></Provider>)
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Gym' } })
        fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-10-22' } })
        fireEvent.click(screen.getByRole('radio', { name: 'Green' }))
        apiFetch.mockResolvedValueOnce({ id: 31, name: 'Gym' })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })) })
        expect(bodyOf('/api/tasks')).toMatchObject({ name: 'Gym', color: 'green', reminder_email: false })
    })

    it('the app tells the server its time zone and language', async () => {
        const store = makeStore()
        function Probe() { useAccountLocale(true); return null }
        await act(async () => { render(<Provider store={store}><Probe /></Provider>) })
        expect(bodyOf('/api/users/locale', 'PUT')).toEqual({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, language: 'en' })
    })
})
