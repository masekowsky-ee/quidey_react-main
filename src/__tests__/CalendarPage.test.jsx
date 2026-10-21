import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import Calendar from '../components/Calendar'
import WeekDaysContainer from '../components/WeekDaysContainer'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

// The API sends a date column as "local midnight, written in UTC"
const apiDate = (year, month, day) => new Date(year, month - 1, day).toISOString()

const TASKS = [
    { id: 1, name: 'Dentist', due: apiDate(2026, 10, 19), prio: 80, done: false, description: 'Bring the card', group_ids: [10] },
    { id: 2, name: 'Report', due: apiDate(2026, 10, 21), prio: 40, done: false, group_ids: [] },
    { id: 3, name: 'Old bill', due: apiDate(2026, 10, 12), prio: 20, done: false, group_ids: [] },
    { id: 4, name: 'Finished thing', due: apiDate(2026, 10, 21), prio: 10, done: true, group_ids: [] },
]
const GROUPS = [{ id: 10, name: 'Health' }, { id: 99, name: 'all' }]

// where the router is, to check the address the calendar writes
function LocationSpy() {
    const { search } = useLocation()
    return <output data-testid="location" hidden>{search}</output>
}

function setup(path = '/calendar?date=2026-10-19') {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('en'))
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks: TASKS, groups: GROUPS, notes: [] } })
    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/calendar" element={<><Calendar /><LocationSpy /></>} />
                    <Route path="/" element={<><WeekDaysContainer /><LocationSpy /></>} />
                </Routes>
            </MemoryRouter>
        </Provider>
    )
    return store
}

const cell = (key) => document.querySelector(`[role="gridcell"][data-date="${key}"]`)
const params = () => new URLSearchParams(screen.getByTestId('location').textContent)

beforeEach(() => {
    // Monday, 19 October 2026; only Date is faked so promises and timers still run
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 19, 10, 0))
    apiFetch.mockReset()
    apiFetch.mockResolvedValue([])
    localStorage.clear()
})

afterEach(() => {
    vi.useRealTimers()
})

describe('month view', () => {
    it('shows the month with week numbers and tasks on their days', () => {
        setup()
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('October 2026')
        expect(screen.getByRole('button', { name: 'Week 43' })).toBeInTheDocument()
        expect(within(cell('2026-10-19')).getByText('Dentist')).toBeInTheDocument()
        expect(within(cell('2026-10-21')).getByText('Report')).toBeInTheDocument()
        expect(cell('2026-10-19')).toHaveAttribute('aria-current', 'date')
        // one overdue task (Old bill, 12 Oct)
        expect(screen.getByRole('button', { name: '1 overdue' })).toBeInTheDocument()
    })

    it('goes to the next month and back to today', () => {
        setup()
        fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('November 2026')
        expect(params().get('date')).toBe('2026-11-19')
        fireEvent.click(screen.getByRole('button', { name: 'Today' }))
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('October 2026')
    })

    it('moves between days with the arrow keys and opens one with Enter', () => {
        setup()
        const today = cell('2026-10-19')
        expect(today).toHaveAttribute('tabindex', '0')
        today.focus()
        fireEvent.keyDown(today, { key: 'ArrowRight' })
        expect(document.activeElement).toBe(cell('2026-10-20'))
        fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
        expect(document.activeElement).toBe(cell('2026-10-27'))
        fireEvent.keyDown(document.activeElement, { key: 'Enter' })
        expect(screen.getByRole('dialog')).toHaveTextContent('27 October 2026')
    })

    it('a week number opens that week', () => {
        setup()
        fireEvent.click(screen.getByRole('button', { name: 'Week 43' }))
        expect(params().get('view')).toBe('week')
        expect(localStorage.getItem('calendarView')).toBe('week')
    })

    it('filters by text and hides done tasks', () => {
        setup()
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search tasks' }), { target: { value: 'dent' } })
        expect(screen.queryByText('Report')).not.toBeInTheDocument()
        expect(screen.getByText('Dentist')).toBeInTheDocument()
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search tasks' }), { target: { value: '' } })
        expect(screen.getByText('Finished thing')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Show done' }))
        expect(screen.queryByText('Finished thing')).not.toBeInTheDocument()
    })

    it('filters by group', () => {
        setup()
        // the hidden "all" group is not offered
        expect(screen.queryByRole('option', { name: 'all' })).not.toBeInTheDocument()
        fireEvent.change(screen.getByRole('combobox', { name: 'Filter by group' }), { target: { value: '10' } })
        expect(screen.getByText('Dentist')).toBeInTheDocument()
        expect(screen.queryByText('Report')).not.toBeInTheDocument()
    })
})

describe('week and agenda view', () => {
    it('the week view lists the week with descriptions', () => {
        setup('/calendar?view=week&date=2026-10-21')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Week 43')
        expect(screen.getAllByRole('gridcell')).toHaveLength(7)
        expect(screen.getByText('Bring the card')).toBeInTheDocument()
    })

    it('the agenda shows overdue tasks, today and the days with tasks', () => {
        setup('/calendar?view=agenda&date=2026-10-19')
        expect(screen.getByRole('heading', { name: /Overdue/ })).toBeInTheDocument()
        expect(screen.getByText('Old bill')).toBeInTheDocument()
        expect(screen.getByText('12.10.2026')).toBeInTheDocument()
        expect(screen.getByText('Today', { selector: 'span' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Wednesday 21 October/ })).toBeInTheDocument()
    })

    it('the agenda can mark a task done', async () => {
        setup('/calendar?view=agenda&date=2026-10-19')
        apiFetch.mockResolvedValueOnce({ ...TASKS[1], done: true })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Mark as done: Report' }))
        })
        const [url, options] = apiFetch.mock.calls.find(call => call[0] === '/api/tasks/2')
        expect(url).toBe('/api/tasks/2')
        expect(JSON.parse(options.body)).toMatchObject({ done: true, due: '2026-10-21' })
    })

    it('keyboard shortcuts switch the view', () => {
        setup()
        fireEvent.keyDown(window, { key: 'a' })
        expect(params().get('view')).toBe('agenda')
        fireEvent.keyDown(window, { key: 'w' })
        expect(params().get('view')).toBe('week')
    })
})

describe('day panel', () => {
    it('opens on a click and lists the day\'s tasks, done ones too', () => {
        setup('/calendar?date=2026-10-21')
        fireEvent.click(cell('2026-10-21'))
        const dialog = screen.getByRole('dialog')
        expect(dialog).toHaveTextContent('21 October 2026')
        expect(within(dialog).getByText('Report')).toBeInTheDocument()
        expect(within(dialog).getByText('Finished thing')).toBeInTheDocument()
        expect(params().get('day')).toBe('2026-10-21')
    })

    it('opens from the address, goes to the next day and closes with Escape', () => {
        setup('/calendar?date=2026-10-19&day=2026-10-19')
        expect(screen.getByRole('dialog')).toHaveTextContent('19 October 2026')
        fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
        expect(screen.getByRole('dialog')).toHaveTextContent('20 October 2026')
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(params().get('day')).toBeNull()
    })

    it('adds a task on that day', async () => {
        setup('/calendar?date=2026-10-22&day=2026-10-22')
        apiFetch.mockResolvedValueOnce({ id: 50, name: 'Call mom', due: apiDate(2026, 10, 22), prio: 50, done: false })
        fireEvent.change(screen.getByRole('textbox', { name: 'New task for this day…' }), { target: { value: '  Call mom ' } })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        })
        expect(apiFetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({ method: 'POST' }))
        const body = JSON.parse(apiFetch.mock.calls.find(call => call[0] === '/api/tasks')[1].body)
        expect(body).toMatchObject({ name: 'Call mom', due: '2026-10-22', prio: 50 })
        expect(within(screen.getByRole('dialog')).getByText('Call mom')).toBeInTheDocument()
        expect(within(cell('2026-10-22')).getByText('Call mom')).toBeInTheDocument()
    })

    it('edits a task and moves it to another day', async () => {
        setup('/calendar?date=2026-10-19&day=2026-10-19')
        fireEvent.click(screen.getByRole('button', { name: 'Edit: Dentist' }))
        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Dentist')
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Dentist (check-up)' } })
        fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-10-23' } })
        apiFetch.mockResolvedValueOnce({ ...TASKS[0], name: 'Dentist (check-up)', due: apiDate(2026, 10, 23) })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Save' }))
        })
        const body = JSON.parse(apiFetch.mock.calls.find(call => call[0] === '/api/tasks/1')[1].body)
        expect(body).toMatchObject({ name: 'Dentist (check-up)', due: '2026-10-23', prio: 80, description: 'Bring the card' })
        expect(within(cell('2026-10-23')).getByText('Dentist (check-up)')).toBeInTheDocument()
        expect(within(screen.getByRole('dialog')).queryByText('Dentist (check-up)')).not.toBeInTheDocument()
    })

    it('Escape in the editor only closes the editor', () => {
        setup('/calendar?date=2026-10-19&day=2026-10-19')
        fireEvent.click(screen.getByRole('button', { name: 'Edit: Dentist' }))
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name' }), { key: 'Escape' })
        expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument()
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('deletes a task', async () => {
        setup('/calendar?date=2026-10-19&day=2026-10-19')
        fireEvent.click(screen.getByRole('button', { name: 'Edit: Dentist' }))
        apiFetch.mockResolvedValueOnce({ message: 'Task deleted' })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Delete: Dentist' }))
        })
        expect(apiFetch).toHaveBeenCalledWith('/api/tasks/1', { method: 'DELETE' })
        expect(screen.queryByText('Dentist')).not.toBeInTheDocument()
    })

    it('shows the focus sessions of the day', () => {
        const store = setup('/calendar?date=2026-10-19')
        act(() => {
            store.dispatch({ type: 'SET_WORKED_SESSIONS', payload: [
                { id: 1, date: new Date(2026, 9, 19, 9, 30).toISOString(), totalTime: 1800, group: 'all', workedTasks: [{ id: 1, name: 'Dentist', time: 1800 }] },
            ] })
        })
        expect(within(cell('2026-10-19')).getByText('30m')).toBeInTheDocument()
        fireEvent.click(cell('2026-10-19'))
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByText('Focus time')).toBeInTheDocument()
        expect(within(dialog).getAllByText('30 min').length).toBeGreaterThan(0)
        expect(within(dialog).getByRole('link', { name: /Open history/ })).toHaveAttribute('href', '/history')
    })
})

describe('drag and drop', () => {
    it('dropping a task on another day reschedules it', async () => {
        setup()
        const chip = within(cell('2026-10-21')).getByText('Report').closest('button')
        const target = cell('2026-10-24')
        document.elementFromPoint = vi.fn(() => target)
        apiFetch.mockResolvedValueOnce({ ...TASKS[1], due: apiDate(2026, 10, 24) })

        fireEvent.pointerDown(chip, { button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 })
        await act(async () => {
            window.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: 40 }))
        })
        expect(target.className).toMatch(/dropTarget/)
        await act(async () => {
            window.dispatchEvent(new MouseEvent('pointerup', { clientX: 60, clientY: 40 }))
        })

        const body = JSON.parse(apiFetch.mock.calls.find(call => call[0] === '/api/tasks/2')[1].body)
        expect(body.due).toBe('2026-10-24')
        expect(within(cell('2026-10-24')).getByText('Report')).toBeInTheDocument()
        // the drop didn't also open the day
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        delete document.elementFromPoint
    })

    it('a small move is a click: it opens the task', () => {
        setup()
        const chip = within(cell('2026-10-21')).getByText('Report').closest('button')
        fireEvent.pointerDown(chip, { button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 })
        window.dispatchEvent(new MouseEvent('pointerup', { clientX: 12, clientY: 11 }))
        fireEvent.click(chip)
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Report')
        expect(apiFetch.mock.calls.some(call => call[0] === '/api/tasks/2')).toBe(false)
    })
})

describe('shared calendars', () => {
    const SESSION = {
        id: 5, name: 'Exam prep', me: 1, isOwner: false, endedAt: null, people: [], events: [],
        tasks: [
            { id: 70, name: 'Mock exam', due: apiDate(2026, 10, 22), due_time: '09:00', done: false, addedBy: { id: 2, username: 'bo', displayName: 'Bo' } },
            { id: 71, name: 'Flashcards', due: apiDate(2026, 10, 20), done: false, addedBy: { id: 1, username: 'me', displayName: 'Me' } },
        ],
    }
    const FAMILY = {
        id: 3, name: 'The Bergs', me: 1, isOwner: true, people: [],
        tasks: [{ id: 90, name: 'Grandma visits', due: apiDate(2026, 10, 24), done: false, addedBy: { id: 2, username: 'bo', displayName: 'Bo' } }],
    }

    const answer = (routes) => apiFetch.mockImplementation(async (url, options) => {
        const route = routes[`${options?.method ?? 'GET'} ${url}`];
        if (route) return typeof route === 'function' ? route(options) : route;
        return [];
    });

    const withAccess = (store, isTester) => act(() => {
        store.dispatch({ type: 'SET_ACCESS', payload: { isPro: true, isTester } });
        store.dispatch({ type: 'SET_SHARED_SESSIONS', payload: { sessions: [{ id: 5, name: 'Exam prep', endedAt: null }], invites: [] } });
    });

    it("shows a session's tasks instead of mine, and adds to the session", async () => {
        answer({
            'GET /api/shared-sessions/5': SESSION,
            'POST /api/shared-sessions/5/tasks': (options) => ({ ...SESSION, tasks: [...SESSION.tasks, { id: 72, name: JSON.parse(options.body).name, due: apiDate(2026, 10, 22), done: false, addedBy: { id: 1 } }] }),
        })
        await act(async () => { setup('/calendar?date=2026-10-19&cal=session-5') })
        expect(within(cell('2026-10-22')).getByText('Mock exam')).toBeInTheDocument()
        expect(screen.queryByText('Dentist')).not.toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: 'Calendar' })).toHaveValue('session-5')
        expect(screen.getByRole('link', { name: 'Open session →' })).toHaveAttribute('href', '/together/5')

        fireEvent.click(cell('2026-10-22'))
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByText('by Bo')).toBeInTheDocument()
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'New task for this day…' }), { target: { value: 'Group call' } })
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Add' })) })
        const call = apiFetch.mock.calls.find(([url, options]) => url === '/api/shared-sessions/5/tasks' && options?.method === 'POST')
        expect(JSON.parse(call[1].body)).toEqual({ name: 'Group call', due: '2026-10-22' })
        expect(within(cell('2026-10-22')).getByText('Group call')).toBeInTheDocument()
        expect(apiFetch.mock.calls.some(([url]) => url === '/api/tasks')).toBe(false)
    })

    it('only who added a task (or the owner) gets the delete button; edits go to the session', async () => {
        answer({
            'GET /api/shared-sessions/5': SESSION,
            'PATCH /api/shared-sessions/5/tasks/70': { ...SESSION, tasks: [{ ...SESSION.tasks[0], due: apiDate(2026, 10, 23) }, SESSION.tasks[1]] },
        })
        await act(async () => { setup('/calendar?date=2026-10-19&day=2026-10-22&cal=session-5') })
        fireEvent.click(screen.getByRole('button', { name: 'Edit: Mock exam' }))
        expect(screen.queryByRole('button', { name: 'Delete: Mock exam' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Assign group' })).not.toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-10-23' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
        const call = apiFetch.mock.calls.find(([url]) => url === '/api/shared-sessions/5/tasks/70')
        expect(call[1].method).toBe('PATCH')
        expect(JSON.parse(call[1].body)).toMatchObject({ due: '2026-10-23', due_time: '09:00' })
        expect(within(cell('2026-10-23')).getByText('Mock exam')).toBeInTheDocument()

        fireEvent.click(cell('2026-10-20'))
        fireEvent.click(screen.getByRole('button', { name: 'Edit: Flashcards' }))
        expect(screen.getByRole('button', { name: 'Delete: Flashcards' })).toBeInTheDocument()
    })

    it("family calendars are for testers; the picker switches between calendars", async () => {
        answer({ 'GET /api/tester/families/3': FAMILY })
        let store
        await act(async () => { store = setup('/calendar?date=2026-10-19&cal=family-3') })
        // not a tester: my own calendar, nothing asked from the tester API
        expect(within(cell('2026-10-19')).getByText('Dentist')).toBeInTheDocument()
        expect(apiFetch.mock.calls.some(([url]) => url.startsWith('/api/tester'))).toBe(false)

        withAccess(store, true)
        act(() => { store.dispatch({ type: 'SET_FAMILIES', payload: { families: [{ id: 3, name: 'The Bergs' }], invites: [] } }) })
        await act(async () => {})
        expect(within(cell('2026-10-24')).getByText('Grandma visits')).toBeInTheDocument()
        expect(screen.queryByText('Dentist')).not.toBeInTheDocument()

        const picker = screen.getByRole('combobox', { name: 'Calendar' })
        expect(within(picker).getByRole('option', { name: 'Exam prep' })).toBeInTheDocument()
        fireEvent.change(picker, { target: { value: 'mine' } })
        expect(params().get('cal')).toBeNull()
        expect(within(cell('2026-10-19')).getByText('Dentist')).toBeInTheDocument()
    })

    it("a calendar I'm not in leads back to my own", async () => {
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/shared-sessions/8') throw Object.assign(new Error('Session not found'), { status: 404 })
            return []
        })
        let store
        await act(async () => { store = setup('/calendar?date=2026-10-19&cal=session-8') })
        expect(params().get('cal')).toBeNull()
        expect(within(cell('2026-10-19')).getByText('Dentist')).toBeInTheDocument()
        expect(store.getState().toast[0].text).toContain("isn't available")
    })
})

describe('week strip on the home page', () => {
    it('opens a day in the calendar and points to overdue tasks', () => {
        setup('/')
        const link = screen.getByText('Dentist').closest('a')
        expect(link).toHaveAttribute('href', '/calendar?date=2026-10-19&day=2026-10-19')
        expect(screen.getByRole('link', { name: 'Calendar: 1 overdue' })).toHaveAttribute('href', '/calendar?view=agenda&date=2026-10-19')
    })
})
