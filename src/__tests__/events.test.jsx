import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch, isOverdue } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import { updateEventType, deleteEventType } from '../features/tasks/taskAction'
import { eventEnd, isEventNow } from '../features/tasks/kinds'
import { taskColorAttr } from '../features/tasks/taskColors'
import { plannedProgress, selectFocusByTask } from '../features/tasks/plannedTime'
import { periodOf, periodQuery, sumByBucket, hoursText, inPeriod } from '../features/stats/period'
import { dateKey } from '../features/calendar/calendar'
import TaskForm from '../components/TaskForm'
import TaskContainer from '../components/TaskContainer'
import Calendar from '../components/Calendar'
import Stats from '../components/Stats'
import EventTypeSettings from '../components/EventTypeSettings'
import { DurationWheel } from '../components/task/DurationWheel'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const bodyOf = (path, method) => {
    const call = apiFetch.mock.calls.find(([url, options]) => url === path && (!method || options?.method === method))
    return call && JSON.parse(call[1].body)
}

const WORK = { id: 7, name: 'Work', color: 'blue', position: 0 }

function makeStore(tasks = [], eventTypes = []) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('en'))
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks, groups: [], notes: [], eventTypes } })
    return store
}

// answers by "METHOD /path" (GET when no method); everything else gets an empty list
const routes = (map) => apiFetch.mockImplementation(async (url, options = {}) => {
    const key = `${options.method ?? 'GET'} ${url}`
    return key in map ? (typeof map[key] === 'function' ? map[key](options) : map[key]) : []
})

const wrap = (store, ui, path = '/') => render(<Provider store={store}><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></Provider>)
const todayKey = () => dateKey(new Date())

beforeEach(() => {
    apiFetch.mockReset()
    // friends, profile and the like load on their own: an empty answer
    apiFetch.mockImplementation(async () => [])
    localStorage.clear()
})

describe('events: helpers', () => {
    const shift = { id: 1, kind: 'event', name: 'Shift', due: '2026-10-20', due_time: '09:00', duration_minutes: 480, done: false }

    it('end after their length, or with their day; never overdue', () => {
        const end = eventEnd(shift)
        expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([20, 17, 0])
        const allDay = eventEnd({ ...shift, due_time: null })
        expect([allDay.getDate(), allDay.getHours()]).toEqual([21, 0])
        expect(eventEnd({ ...shift, kind: 'task' })).toBeNull()
        expect(isOverdue(shift, new Date(2026, 10, 1))).toBe(false)
        expect(isOverdue({ ...shift, kind: 'task' }, new Date(2026, 10, 1))).toBe(true)
        expect(isEventNow(shift, new Date(2026, 9, 20, 12))).toBe(true)
        expect(isEventNow(shift, new Date(2026, 9, 20, 18))).toBe(false)
    })

    it('take their type\'s colour unless they have their own', () => {
        expect(taskColorAttr({ ...shift, event_type: WORK })).toBe('blue')
        expect(taskColorAttr({ ...shift, color: 'red', event_type: WORK })).toBe('red')
        expect(taskColorAttr({ ...shift, kind: 'task', event_type: WORK })).toBeUndefined()
    })

    it("a task's planned time is set against the focus spent on it", () => {
        const state = {
            session: {
                workedSessionData: [{ workedTasks: [{ id: 3, time: 1800 }, { id: 'shared-4', time: 600, shared: {} }] }],
                currentSessionData: { workedTasks: [{ id: 3, time: 1200 }] },
            },
        }
        const focus = selectFocusByTask(state)
        expect(focus[3]).toBe(3000)
        expect(plannedProgress({ id: 3, duration_minutes: 100 }, focus)).toEqual({ planned: 100, spent: 50, share: 0.5 })
        expect(plannedProgress({ id: 3, duration_minutes: null }, focus)).toBeNull()
        expect(plannedProgress({ id: 3, kind: 'event', duration_minutes: 100 }, focus)).toBeNull()
    })
})

describe('statistics periods', () => {
    const today = new Date(2026, 9, 22) // a Thursday

    it('weeks and months step back from today', () => {
        const week = periodOf('week', 0, today)
        expect([dateKey(week.from), dateKey(week.to)]).toEqual(['2026-10-19', '2026-10-25'])
        expect(week.buckets).toHaveLength(7)
        expect(periodQuery(periodOf('week', -1, today))).toBe('?from=2026-10-12&to=2026-10-18')
        const lastMonth = periodOf('month', -1, today)
        expect([dateKey(lastMonth.from), dateKey(lastMonth.to)]).toEqual(['2026-09-01', '2026-09-30'])
        expect(lastMonth.buckets).toHaveLength(30)
        const year = periodOf('year', 0, today)
        expect(year.unit).toBe('month')
        expect(year.buckets.map(b => b.key).at(-1)).toBe('2026-12')
    })

    it('everything goes from the first day, by month and by year when it is long', () => {
        expect(periodOf('all', 0, today, '2026-08-03').buckets.map(b => b.key)).toEqual(['2026-08', '2026-09', '2026-10'])
        expect(periodOf('all', 0, today, '2020-01-01').unit).toBe('year')
        expect(periodQuery(periodOf('all', 0, today))).toBe('')
        expect(inPeriod(periodOf('all', 0, today), '1999-01-01')).toBe(true)
    })

    it('sums days into the buckets and says hours as hours', () => {
        expect(sumByBucket('month', [{ day: '2026-10-01', ms: 1 }, { day: '2026-10-20', ms: 2 }, { day: '2026-11-01', ms: 4 }]))
            .toEqual({ '2026-10': 3, '2026-11': 4 })
        expect(hoursText(32 * 3600000)).toBe('32 h')
        expect(hoursText(90 * 60000)).toBe('1 h 30 min')
        expect(hoursText(45 * 60000)).toBe('45 min')
    })
})

describe('event types in the store', () => {
    it('a renamed type shows on its events, a deleted one leaves them without a type', async () => {
        const event = { id: 1, kind: 'event', name: 'Shift', event_type_id: 7, event_type: { id: 7, name: 'Work', color: 'blue' } }
        const store = makeStore([event], [WORK])
        apiFetch.mockResolvedValueOnce({ ...WORK, name: 'Job' })
        await store.dispatch(updateEventType(7, { name: 'Job' }))
        expect(store.getState().task.tasks[0].event_type.name).toBe('Job')
        expect(store.getState().task.eventTypes[0].name).toBe('Job')
        apiFetch.mockResolvedValueOnce({ message: 'Event type deleted' })
        await store.dispatch(deleteEventType(7))
        expect(store.getState().task.eventTypes).toEqual([])
        expect(store.getState().task.tasks[0]).toMatchObject({ event_type_id: null, event_type: null })
    })
})

describe('the length wheels', () => {
    it('turn by keyboard and quick picks; 0 h 0 min is none', () => {
        const onChange = vi.fn()
        const { rerender } = render(<Provider store={makeStore()}><DurationWheel value={90} onChange={onChange} label="Length" /></Provider>)
        const hours = screen.getByRole('spinbutton', { name: 'Length: Hours' })
        expect(hours).toHaveAttribute('aria-valuenow', '1')
        expect(screen.getByRole('spinbutton', { name: 'Length: Minutes' })).toHaveAttribute('aria-valuenow', '30')
        fireEvent.keyDown(hours, { key: 'ArrowDown' })
        expect(onChange).toHaveBeenLastCalledWith(150)
        fireEvent.click(screen.getByRole('button', { name: '8 h' }))
        expect(onChange).toHaveBeenLastCalledWith(480)
        rerender(<Provider store={makeStore()}><DurationWheel value={30} onChange={onChange} label="Length" /></Provider>)
        fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Length: Minutes' }), { key: 'Home' })
        expect(onChange).toHaveBeenLastCalledWith(null)
    })
})

describe('creating an event', () => {
    it('needs a day; has a length and a type (a suggestion becomes my type) instead of a priority', async () => {
        const setCreateTask = vi.fn()
        const store = makeStore()
        wrap(store, <TaskForm setCreateTask={setCreateTask} />)
        fireEvent.click(screen.getByRole('radio', { name: /^Event/ }))
        expect(screen.getByRole('heading', { name: 'Create event' })).toBeInTheDocument()
        expect(screen.queryByLabelText(/Priority/)).not.toBeInTheDocument()
        fireEvent.change(screen.getByRole('textbox', { name: 'Event name' }), { target: { value: 'Shift' } })

        // without a day it is refused
        routes({})
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })) })
        expect(bodyOf('/api/tasks', 'POST')).toBeUndefined()

        fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-10-19' } })
        fireEvent.change(screen.getByLabelText(/^Start/), { target: { value: '09:00' } })
        fireEvent.click(screen.getByRole('button', { name: 'None' }))
        fireEvent.click(screen.getByRole('button', { name: '8 h' }))
        expect(screen.getByText(/until 17:00/)).toBeInTheDocument()

        routes({ 'POST /api/event-types': WORK, 'POST /api/tasks': { id: 40, name: 'Shift', kind: 'event', done: true } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '+ Work' })) })
        expect(bodyOf('/api/event-types', 'POST')).toEqual({ name: 'Work', color: 'blue' })
        expect(screen.getByRole('radio', { name: 'Work' })).toBeChecked()

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })) })
        expect(bodyOf('/api/tasks', 'POST')).toMatchObject({
            name: 'Shift', kind: 'event', event_type_id: 7, due: '2026-10-19', due_time: '09:00', duration_minutes: 480, prio: null,
        })
        expect(setCreateTask).toHaveBeenCalledWith(false)
    })

    it('a repeating event entered afterwards comes back with its next one', async () => {
        const store = makeStore()
        wrap(store, <TaskForm setCreateTask={vi.fn()} />)
        fireEvent.click(screen.getByRole('radio', { name: /^Event/ }))
        fireEvent.change(screen.getByRole('textbox', { name: 'Event name' }), { target: { value: 'Lecture' } })
        fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-10-19' } })
        routes({ 'POST /api/tasks': { id: 41, name: 'Lecture', kind: 'event', done: true, nextTask: { id: 42, name: 'Lecture', kind: 'event', done: false } } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })) })
        expect(store.getState().task.tasks.map(t => t.id)).toEqual([41, 42])
    })
})

describe('events on Home and in the calendar', () => {
    const now = new Date()
    const event = { id: 2, kind: 'event', name: 'Lecture', due: todayKey(), due_time: '00:00', duration_minutes: 1439, done: false, prio: null, group_ids: [], event_type_id: 7, event_type: { id: 7, name: 'Work', color: 'blue' } }
    const task = { id: 1, name: 'Essay', due: todayKey(), done: false, prio: 50, group_ids: [] }

    it('the task list holds tasks; today\'s events sit in their own strip above it', () => {
        wrap(makeStore([task, event], [WORK]), <TaskContainer working={false} handlePointerDown={vi.fn()} setCreateTask={vi.fn()} />)
        const list = screen.getByRole('list', { name: 'To Do' })
        expect(within(list).getByText('Essay')).toBeInTheDocument()
        expect(within(list).queryByText('Lecture')).not.toBeInTheDocument()
        const strip = screen.getByRole('region', { name: 'Today' })
        expect(within(strip).getByText('Lecture')).toBeInTheDocument()
        expect(within(strip).getByText('Work')).toBeInTheDocument()
        if (now.getHours() < 23) expect(within(strip).getByText('now')).toBeInTheDocument()
    })

    it('an event has no tick in the day panel; the quick add makes events too', async () => {
        const store = makeStore([event], [WORK])
        wrap(store, <Calendar />, `/calendar?date=${todayKey()}&day=${todayKey()}`)
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).queryByRole('button', { name: /Mark as done: Lecture/ })).not.toBeInTheDocument()
        fireEvent.click(within(dialog).getByRole('radio', { name: 'Event' }))
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'New event on this day…' }), { target: { value: 'Gym' } })
        apiFetch.mockResolvedValueOnce({ id: 9, name: 'Gym', kind: 'event', due: todayKey() })
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Add' })) })
        expect(bodyOf('/api/tasks', 'POST')).toMatchObject({ name: 'Gym', kind: 'event', prio: null })
    })
})

describe('statistics page', () => {
    const stats = {
        today: todayKey(), from: null, to: null, firstDay: todayKey(),
        focus: { ms: 5400000, sessions: 2, days: [{ day: todayKey(), ms: 5400000 }] },
        events: { ms: 32 * 3600000, count: 4, days: [{ day: todayKey(), ms: 32 * 3600000 }],
            types: [{ id: 7, name: 'Work', color: 'blue', ms: 32 * 3600000, count: 4 }] },
        groups: [], tasksDone: 3,
    }

    it('shows the period\'s numbers, time per event type, and steps back', async () => {
        apiFetch.mockImplementation(async (url) => (url.startsWith('/api/stats') ? stats : url === '/api/profile' ? {} : []))
        await act(async () => { wrap(makeStore(), <Stats />, '/stats') })
        expect(screen.getByRole('heading', { name: 'Statistics' })).toBeInTheDocument()
        expect(apiFetch).toHaveBeenCalledWith(`/api/stats${periodQuery(periodOf('week', 0))}`)
        expect(screen.getByText('This week')).toBeInTheDocument()
        const byType = screen.getByRole('region', { name: 'Events by type' })
        expect(within(byType).getByText('Work')).toBeInTheDocument()
        expect(within(byType).getByText('32 h')).toBeInTheDocument()
        expect(within(byType).getByText('4 events')).toBeInTheDocument()

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Previous period' })) })
        expect(screen.getByText('Last week')).toBeInTheDocument()
        expect(apiFetch).toHaveBeenCalledWith(`/api/stats${periodQuery(periodOf('week', -1))}`)

        await act(async () => { fireEvent.click(screen.getByRole('radio', { name: 'Month' })) })
        expect(screen.getByText('This month')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled()
    })

    it('the chart has a table with the same numbers', async () => {
        apiFetch.mockImplementation(async (url) => (url.startsWith('/api/stats') ? stats : {}))
        await act(async () => { wrap(makeStore(), <Stats />, '/stats?range=all') })
        const table = screen.getByRole('table')
        const row = within(table).getAllByRole('row').at(-1)
        expect(row).toHaveTextContent('1 h 30 min')
        expect(row).toHaveTextContent('32 h')
    })
})

describe('event types in the settings', () => {
    it('suggestions are added with their colour; renaming saves on leaving the field', async () => {
        const store = makeStore([], [WORK])
        wrap(store, <EventTypeSettings />)
        apiFetch.mockResolvedValueOnce({ id: 8, name: 'Lecture', color: 'violet', position: 1 })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '+ Lecture' })) })
        expect(bodyOf('/api/event-types', 'POST')).toEqual({ name: 'Lecture', color: 'violet' })
        expect(store.getState().task.eventTypes.map(t => t.name)).toEqual(['Work', 'Lecture'])

        const name = screen.getByRole('textbox', { name: 'Name of Work' })
        fireEvent.change(name, { target: { value: 'Job' } })
        apiFetch.mockResolvedValueOnce({ ...WORK, name: 'Job' })
        await act(async () => { fireEvent.blur(name) })
        expect(bodyOf('/api/event-types/7', 'PUT')).toEqual({ name: 'Job' })
    })
})
