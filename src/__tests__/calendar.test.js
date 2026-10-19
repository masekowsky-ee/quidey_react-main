import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { parseDate, formatDate, toInputDate, isOverdue, apiFetch } from '../features/helperFunction'
import { updateTaskProps, addTask } from '../features/tasks/taskAction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import {
    fromKey, addDays, addMonths, startOfWeek, weekDates, monthDates, isoWeek, prioLevel,
    compareTasks, groupByDay, filterTasks, focusByDay, formatFocus, toIcs,
    readStoredCalendarView, storeCalendarView,
} from '../features/calendar/calendar'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

// The API sends a date column as "local midnight, written in UTC"
const apiDate = (year, month, day) => new Date(year, month - 1, day).toISOString()
const key = (date) => toInputDate(date)

beforeEach(() => {
    apiFetch.mockReset()
    localStorage.clear()
})

describe('dates from the api and from forms', () => {
    it('reads a plain YYYY-MM-DD as that local day, not as UTC midnight', () => {
        const date = parseDate('2026-10-20')
        expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 20])
        expect(formatDate('2026-10-20')).toBe('20.10.2026')
        expect(toInputDate('2026-10-20')).toBe('2026-10-20')
    })

    it('reads the api timestamp as the day that was saved', () => {
        expect(toInputDate(apiDate(2026, 10, 20))).toBe('2026-10-20')
    })

    it('gives null / empty text for missing or broken values', () => {
        expect(parseDate(null)).toBeNull()
        expect(parseDate('not a date')).toBeNull()
        expect(toInputDate('not a date')).toBe('')
    })

    it('fromKey only accepts real days', () => {
        expect(key(fromKey('2026-02-28'))).toBe('2026-02-28')
        expect(fromKey('2026-02-30')).toBeNull()
        expect(fromKey('20.10.2026')).toBeNull()
        expect(fromKey(null)).toBeNull()
    })

    it('isOverdue: open and before today', () => {
        const today = new Date(2026, 9, 19, 15)
        expect(isOverdue({ due: apiDate(2026, 10, 18), done: false }, today)).toBe(true)
        expect(isOverdue({ due: apiDate(2026, 10, 19), done: false }, today)).toBe(false)
        expect(isOverdue({ due: apiDate(2026, 10, 18), done: true }, today)).toBe(false)
        expect(isOverdue({ due: null, done: false }, today)).toBe(false)
    })
})

describe('calendar date math', () => {
    it('addMonths keeps the day, or uses the month\'s last day', () => {
        expect(key(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28')
        expect(key(addMonths(new Date(2028, 0, 31), 1))).toBe('2028-02-29')
        expect(key(addMonths(new Date(2026, 2, 15), -3))).toBe('2025-12-15')
    })

    it('addDays crosses months and the switch to winter time', () => {
        expect(key(addDays(new Date(2026, 9, 31), 1))).toBe('2026-11-01')
        expect(key(addDays(new Date(2026, 9, 24), 2))).toBe('2026-10-26')
    })

    it('weeks start on Monday', () => {
        expect(key(startOfWeek(new Date(2026, 9, 18)))).toBe('2026-10-12') // Sunday
        expect(weekDates(new Date(2026, 9, 21)).map(key)).toEqual([
            '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25',
        ])
    })

    it('monthDates lists every day of the month', () => {
        expect(monthDates(new Date(2026, 1, 10))).toHaveLength(28)
        expect(monthDates(new Date(2026, 9, 1))).toHaveLength(31)
    })

    it('isoWeek follows ISO 8601', () => {
        expect(isoWeek(new Date(2026, 9, 19))).toBe(43)
        expect(isoWeek(new Date(2026, 0, 1))).toBe(1) // Thursday
        expect(isoWeek(new Date(2027, 0, 1))).toBe(53) // Friday: still the last week of 2026
        expect(isoWeek(new Date(2024, 11, 30))).toBe(1) // Monday of week 1 of 2025
    })
})

describe('tasks by day', () => {
    const tasks = [
        { id: 1, name: 'B low', due: apiDate(2026, 10, 20), prio: 10, done: false, group_ids: [3] },
        { id: 2, name: 'A done', due: apiDate(2026, 10, 20), prio: 90, done: true, group_ids: [] },
        { id: 3, name: 'C high', due: '2026-10-20', prio: 80, done: false, description: 'Call the bank' },
        { id: 4, name: 'No day', due: null, prio: 50, done: false },
    ]

    it('groups by day and sorts open first, then by priority', () => {
        const days = groupByDay(tasks)
        expect(Object.keys(days)).toEqual(['2026-10-20'])
        expect(days['2026-10-20'].map(task => task.id)).toEqual([3, 1, 2])
    })

    it('compareTasks falls back to the name', () => {
        expect([{ name: 'b' }, { name: 'a' }].sort(compareTasks).map(task => task.name)).toEqual(['a', 'b'])
    })

    it('filters by group, done and text (name or description)', () => {
        expect(filterTasks(tasks, { groupId: 3 }).map(task => task.id)).toEqual([1])
        expect(filterTasks(tasks, { showDone: false }).map(task => task.id)).toEqual([1, 3, 4])
        expect(filterTasks(tasks, { query: 'bank' }).map(task => task.id)).toEqual([3])
        expect(filterTasks(tasks, { query: '  a DONE ' }).map(task => task.id)).toEqual([2])
    })

    it('priority levels', () => {
        expect(prioLevel(null)).toBeNull()
        expect(prioLevel(0)).toBe('low')
        expect(prioLevel('50')).toBe('medium')
        expect(prioLevel(67)).toBe('high')
    })
})

describe('focus time per day', () => {
    it('adds up the sessions of each day', () => {
        const sessions = [
            { id: 1, date: new Date(2026, 9, 19, 9).toISOString(), totalTime: 1500 },
            { id: 2, date: new Date(2026, 9, 19, 14).toISOString(), totalTime: 1200 },
            { id: 3, date: new Date(2026, 9, 20, 8).toISOString(), totalTime: 600 },
        ]
        const days = focusByDay(sessions)
        expect(days['2026-10-19'].seconds).toBe(2700)
        expect(days['2026-10-19'].sessions).toHaveLength(2)
        expect(days['2026-10-20'].seconds).toBe(600)
    })

    it('formats long and short', () => {
        expect(formatFocus(2700)).toBe('45 min')
        expect(formatFocus(5400)).toBe('1 h 30 min')
        expect(formatFocus(2700, true)).toBe('45m')
        expect(formatFocus(3600, true)).toBe('1h')
        expect(formatFocus(5400, true)).toBe('1h 30')
    })
})

describe('stored calendar view', () => {
    it('falls back to month and remembers a valid choice', () => {
        expect(readStoredCalendarView()).toBe('month')
        storeCalendarView('week')
        expect(readStoredCalendarView()).toBe('week')
        localStorage.setItem('calendarView', 'year')
        expect(readStoredCalendarView()).toBe('month')
    })
})

describe('iCalendar export', () => {
    const now = new Date(Date.UTC(2026, 9, 19, 12, 0, 0))

    it('writes every task with a day as an all-day event', () => {
        const ics = toIcs([
            { id: 7, name: 'Dentist', due: apiDate(2026, 10, 20), done: false },
            { id: 8, name: 'Without day', due: null },
        ], { now })
        const lines = ics.split('\r\n')
        expect(lines[0]).toBe('BEGIN:VCALENDAR')
        expect(lines).toContain('UID:quidey-task-7@quidey')
        expect(lines).toContain('DTSTAMP:20261019T120000Z')
        expect(lines).toContain('DTSTART;VALUE=DATE:20261020')
        expect(lines).toContain('DTEND;VALUE=DATE:20261021')
        expect(lines).toContain('SUMMARY:Dentist')
        expect(ics).not.toContain('Without day')
        expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    })

    it('escapes special characters, marks done tasks and adds the groups', () => {
        const ics = toIcs([{ id: 1, name: 'Buy milk, eggs; bread', description: 'Line 1\nLine 2 \\ end', due: '2026-10-20', done: true }],
            { now, groupName: () => 'Home' })
        expect(ics).toContain('SUMMARY:✓ Buy milk\\, eggs\\; bread')
        expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2 \\\\ end\\nHome')
    })

    it('folds long lines at 75 bytes without splitting characters', () => {
        const ics = toIcs([{ id: 1, name: 'ä'.repeat(100), due: '2026-10-20' }], { now })
        const physical = ics.split('\r\n')
        const encoder = new TextEncoder()
        for (const line of physical) expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
        // unfolding gives the original line back
        expect(ics.replace(/\r\n /g, '')).toContain(`SUMMARY:${'ä'.repeat(100)}`)
    })
})

describe('saving a task keeps its day', () => {
    const makeStore = () => {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [], groups: [], notes: [] } })
        return store
    }

    it('sends the day as YYYY-MM-DD, not the api timestamp (which the db would read as the day before)', async () => {
        const store = makeStore()
        const task = { id: 5, name: 'x', due: '2026-10-19T22:00:00.000Z', description: null, prio: 50, done: false }
        apiFetch.mockResolvedValueOnce({ ...task, done: true })

        await store.dispatch(updateTaskProps({ done: true }, task))

        const body = JSON.parse(apiFetch.mock.calls[0][1].body)
        expect(body.due).toBe(toInputDate(task.due))
        expect(body.due).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('addTask sends the day as YYYY-MM-DD too', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValueOnce({ id: 9, name: 'x' })
        await store.dispatch(addTask('x', new Date(2026, 9, 21), '', 50))
        expect(JSON.parse(apiFetch.mock.calls[0][1].body).due).toBe('2026-10-21')
    })

    it('a cleared description from the api is applied', async () => {
        const store = makeStore()
        const task = { id: 5, name: 'x', due: '2026-10-20', description: 'old', prio: 50, done: false, group_ids: [2] }
        store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [task], groups: [], notes: [] } })
        apiFetch.mockResolvedValueOnce({ ...task, description: null })

        await store.dispatch(updateTaskProps({ description: '' }, task))

        expect(store.getState().task.tasks[0].description).toBeNull()
        // the groups (not sent back by PUT) stay
        expect(store.getState().task.tasks[0].group_ids).toEqual([2])
    })
})
