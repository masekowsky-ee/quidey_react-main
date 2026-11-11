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
const COLLECTIONS = [{ id: 10, name: 'Health', emoji: null, color: null, items: [{ kind: 'task', id: 1 }] }]

// where the router is, to check the address the calendar writes
function LocationSpy() {
    const { search } = useLocation()
    return <output data-testid="location" hidden>{search}</output>
}

function setup(path = '/calendar?date=2026-10-19', tasks = TASKS) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('en'))
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks, groups: GROUPS, notes: [] } })
    // collections took the place of groups: "Health" holds the dentist
    store.dispatch({ type: 'SET_COLLECTIONS', payload: COLLECTIONS })
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
        // the rarer filters wait behind "Filters", which then counts them
        fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
        fireEvent.click(screen.getByRole('button', { name: 'Show done' }))
        expect(screen.queryByText('Finished thing')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Filters (1)' })).toHaveAttribute('aria-expanded', 'true')
    })

    it('filters by collection (in place of groups)', () => {
        setup()
        // the hidden "all" group is not offered
        fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
        expect(screen.queryByRole('option', { name: 'all' })).not.toBeInTheDocument()
        fireEvent.change(screen.getByRole('combobox', { name: 'Filter by collection' }), { target: { value: 'collection-10' } })
        expect(screen.getByText('Dentist')).toBeInTheDocument()
        expect(screen.queryByText('Report')).not.toBeInTheDocument()
    })
})

describe('toolbar on a phone', () => {
    // a 390px wide screen: only the phone's width query matches
    beforeEach(() => {
        window.matchMedia = vi.fn((query) => ({
            matches: /max-width: (640|720)px/.test(query),
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
        }))
    })
    afterEach(() => { delete window.matchMedia })

    it('is one row: views menu, month and year, search, filters, back and forth', () => {
        setup()
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('October 2026')
        for (const name of ['Calendar view', 'Search tasks', 'Filters', 'Previous month', 'Next month']) {
            expect(screen.getByRole('button', { name })).toBeInTheDocument()
        }
        // no view switch and no search field until asked for
        expect(screen.queryByRole('group', { name: 'Calendar view' })).not.toBeInTheDocument()
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    })

    it('the menu switches the view and jumps to today', () => {
        setup('/calendar?date=2026-12-01')
        fireEvent.click(screen.getByRole('button', { name: 'Calendar view' }))
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Week' }))
        expect(params().get('view')).toBe('week')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('W 49 · Dec 2026')
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Calendar view' }))
        expect(screen.getByRole('menuitemradio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true')
        fireEvent.click(screen.getByRole('menuitem', { name: 'Today' }))
        expect(params().get('date')).toBe('2026-10-19')
    })

    it('the magnifier opens the search; its cross clears and closes it', () => {
        setup()
        fireEvent.click(screen.getByRole('button', { name: 'Search tasks' }))
        const field = screen.getByRole('searchbox', { name: 'Search tasks' })
        expect(document.activeElement).toBe(field)
        fireEvent.change(field, { target: { value: 'dent' } })
        expect(screen.queryByText('Report')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
        expect(screen.getByText('Report')).toBeInTheDocument()
    })

    it('the filter icon opens the filters', () => {
        setup()
        fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
        fireEvent.click(screen.getByRole('button', { name: 'Show done' }))
        expect(screen.queryByText('Finished thing')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Filters (1)' })).toHaveAttribute('aria-expanded', 'true')
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

    it('the plus opens the new-task form on that day', async () => {
        setup('/calendar?date=2026-10-22&day=2026-10-22')
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'New entry on 22 October 2026' }))
        expect(screen.getByLabelText('Due Date')).toHaveValue('2026-10-22')
        apiFetch.mockResolvedValueOnce({ id: 50, name: 'Call mom', due: apiDate(2026, 10, 22), prio: 50, done: false })
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: '  Call mom ' } })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create' }))
        })
        expect(apiFetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({ method: 'POST' }))
        const body = JSON.parse(apiFetch.mock.calls.find(call => call[0] === '/api/tasks')[1].body)
        expect(body).toMatchObject({ name: 'Call mom', due: '2026-10-22' })
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
        expect(within(dialog).getByRole('link', { name: /All sessions/ })).toHaveAttribute('href', '/stats?tab=sessions')
    })
})

describe('adding from the grid', () => {
    it("a day's plus opens the new-task form on that day, without opening the day", () => {
        setup()
        fireEvent.click(within(cell('2026-10-21')).getByRole('button', { name: 'New entry on 21 October 2026' }))
        expect(screen.getByLabelText('Due Date')).toHaveValue('2026-10-21')
        expect(params().get('day')).toBeNull()
    })

    it("the week's plus does the same", () => {
        setup('/calendar?view=week&date=2026-10-21')
        fireEvent.click(within(cell('2026-10-23')).getByRole('button', { name: 'New entry on 23 October 2026' }))
        expect(screen.getByLabelText('Due Date')).toHaveValue('2026-10-23')
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

describe('drag and drop with a finger', () => {
    const wait = (ms) => act(() => new Promise(resolve => setTimeout(resolve, ms)))

    it('holding a task lifts it, then it moves to another day', async () => {
        setup()
        const chip = within(cell('2026-10-21')).getByText('Report').closest('button')
        const target = cell('2026-10-23')
        document.elementFromPoint = vi.fn(() => target)
        apiFetch.mockResolvedValueOnce({ ...TASKS[1], due: apiDate(2026, 10, 23) })

        fireEvent.pointerDown(chip, { button: 0, pointerType: 'touch', clientX: 10, clientY: 10 })
        await wait(350)
        await act(async () => {
            window.dispatchEvent(new MouseEvent('pointermove', { clientX: 80, clientY: 30 }))
        })
        expect(target.className).toMatch(/dropTarget/)
        await act(async () => {
            window.dispatchEvent(new MouseEvent('pointerup', { clientX: 80, clientY: 30 }))
        })
        const body = JSON.parse(apiFetch.mock.calls.find(call => call[0] === '/api/tasks/2')[1].body)
        expect(body.due).toBe('2026-10-23')
        delete document.elementFromPoint
    })

    it('a swipe before the hold is a scroll, not a drag', async () => {
        setup()
        const chip = within(cell('2026-10-21')).getByText('Report').closest('button')
        document.elementFromPoint = vi.fn(() => cell('2026-10-23'))
        fireEvent.pointerDown(chip, { button: 0, pointerType: 'touch', clientX: 10, clientY: 10 })
        window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 60 }))
        await wait(350)
        window.dispatchEvent(new MouseEvent('pointermove', { clientX: 80, clientY: 90 }))
        window.dispatchEvent(new MouseEvent('pointerup', { clientX: 80, clientY: 90 }))
        expect(cell('2026-10-23').className).not.toMatch(/dropTarget/)
        expect(apiFetch.mock.calls.some(call => call[0] === '/api/tasks/2')).toBe(false)
        delete document.elementFromPoint
    })
})

describe('day timeline', () => {
    const TIMED = [
        ...TASKS,
        { id: 6, name: 'Lecture', kind: 'event', due: apiDate(2026, 10, 20), due_time: '09:00', duration_minutes: 90, done: false, group_ids: [] },
        { id: 7, name: 'Read chapter', due: apiDate(2026, 10, 20), due_time: '09:30', prio: 50, done: false, group_ids: [] },
        { id: 8, name: 'Laundry', due: apiDate(2026, 10, 20), prio: 20, done: false, group_ids: [] },
    ]
    const HOUR = 48
    const dialog = () => screen.getByRole('dialog')
    const block = (name) => within(dialog()).getByRole('button', { name: `Edit: ${name}` })

    // jsdom has no layout: the grid gets 48px per hour, the scrolling box a tall window onto it
    function layout() {
        const scroller = within(dialog()).getByRole('region', { name: 'Schedule' })
        const grid = scroller.firstElementChild
        scroller.getBoundingClientRect = () => ({ top: 0, bottom: 2000, left: 0, right: 400, height: 2000, width: 400 })
        grid.getBoundingClientRect = () => ({ top: 0, bottom: 24 * HOUR, left: 0, right: 400, height: 24 * HOUR, width: 400 })
        return { scroller, grid }
    }

    async function dragTo(from, overEl, y) {
        document.elementFromPoint = vi.fn(() => overEl)
        fireEvent.pointerDown(from, { button: 0, pointerType: 'mouse', clientX: 50, clientY: 0 })
        await act(async () => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: y })) })
        await act(async () => { window.dispatchEvent(new MouseEvent('pointerup', { clientX: 60, clientY: y })) })
        delete document.elementFromPoint
    }

    it('shows timed entries on the hours and the rest in the all-day row', () => {
        setup('/calendar?date=2026-10-20&day=2026-10-20', TIMED)
        const lecture = block('Lecture').closest('[data-block]')
        const reading = block('Read chapter').closest('[data-block]')
        expect(lecture.style.getPropertyValue('--start')).toBe('540')
        expect(lecture.style.getPropertyValue('--length')).toBe('90')
        // they overlap, so they share the width
        expect(reading.style.getPropertyValue('--cols')).toBe('2')
        expect(block('Laundry').closest('[data-drop-allday]')).not.toBeNull()
        expect(within(dialog()).getByText('09:00–10:30')).toBeInTheDocument()
    })

    it('dragging a block to another hour changes its time', async () => {
        setup('/calendar?date=2026-10-20&day=2026-10-20', TIMED)
        const { grid } = layout()
        apiFetch.mockResolvedValueOnce({ ...TIMED[5], due_time: '14:15' })
        await dragTo(block('Read chapter'), grid, 14.25 * HOUR)
        const body = JSON.parse(apiFetch.mock.calls.find(call => call[0] === '/api/tasks/7')[1].body)
        expect(body).toMatchObject({ due: '2026-10-20', due_time: '14:15' })
        // the drop didn't also open the editor
        expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument()
    })

    it('an all-day task dragged onto the hours gets a time; a timed one dropped on the all-day row loses it', async () => {
        setup('/calendar?date=2026-10-20&day=2026-10-20', TIMED)
        const { grid } = layout()
        apiFetch.mockResolvedValueOnce({ ...TIMED[6], due_time: '08:00' })
        await dragTo(block('Laundry'), grid, 8 * HOUR)
        expect(JSON.parse(apiFetch.mock.calls.find(call => call[0] === '/api/tasks/8')[1].body).due_time).toBe('08:00')

        const allDay = document.querySelector('[data-drop-allday]')
        apiFetch.mockResolvedValueOnce({ ...TIMED[4], due_time: null })
        await dragTo(block('Lecture'), allDay, 0)
        expect(JSON.parse(apiFetch.mock.calls.find(call => call[0] === '/api/tasks/6')[1].body).due_time).toBeNull()
    })

    it('dropped on the arrow for the next day, it moves there', async () => {
        setup('/calendar?date=2026-10-20&day=2026-10-20', TIMED)
        layout()
        apiFetch.mockResolvedValueOnce({ ...TIMED[5], due: apiDate(2026, 10, 21) })
        await dragTo(block('Read chapter'), screen.getByRole('button', { name: 'Next day' }), 0)
        const body = JSON.parse(apiFetch.mock.calls.find(call => call[0] === '/api/tasks/7')[1].body)
        expect(body).toMatchObject({ due: '2026-10-21', due_time: '09:30' })
    })

    it('Alt and an arrow move the focused block by a quarter hour', async () => {
        setup('/calendar?date=2026-10-20&day=2026-10-20', TIMED)
        apiFetch.mockResolvedValueOnce({ ...TIMED[5], due_time: '09:45' })
        await act(async () => { fireEvent.keyDown(block('Read chapter'), { key: 'ArrowDown', altKey: true }) })
        expect(JSON.parse(apiFetch.mock.calls.find(call => call[0] === '/api/tasks/7')[1].body).due_time).toBe('09:45')
    })

    it('a tap on a free spot of the hours opens the new-task form at that quarter hour', () => {
        setup('/calendar?date=2026-10-20&day=2026-10-20', TIMED)
        const { grid } = layout()
        fireEvent.click(grid, { clientX: 200, clientY: 14.25 * HOUR + 5 })
        expect(screen.getByLabelText('Due Date')).toHaveValue('2026-10-20')
        expect(screen.getByLabelText(/^Time/)).toHaveValue('14:15')
        // the day stays open underneath, and Escape only closes the form
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(screen.getByRole('dialog', { name: /20 October 2026/ })).toBeInTheDocument()
    })

    it('a click opens the editor in place of the timeline, Cancel goes back', () => {
        setup('/calendar?date=2026-10-20&day=2026-10-20', TIMED)
        fireEvent.click(block('Lecture'))
        expect(screen.getByRole('textbox', { name: 'Event name' })).toHaveValue('Lecture')
        expect(within(dialog()).queryByRole('region', { name: 'Schedule' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(within(dialog()).getByRole('region', { name: 'Schedule' })).toBeInTheDocument()
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
        expect(screen.getByRole('link', { name: 'Open session' })).toHaveAttribute('href', '/together/5')

        fireEvent.click(cell('2026-10-22'))
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByText('by Bo')).toBeInTheDocument()
        fireEvent.click(within(dialog).getByRole('button', { name: 'New entry on 22 October 2026' }))
        // the form says where it goes, and leaves out what's personal
        expect(screen.getByText(/Goes into the session “Exam prep”/)).toBeInTheDocument()
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Group call' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })) })
        const call = apiFetch.mock.calls.find(([url, options]) => url === '/api/shared-sessions/5/tasks' && options?.method === 'POST')
        expect(JSON.parse(call[1].body)).toMatchObject({ name: 'Group call', due: '2026-10-22', due_time: null })
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

    it("shows a family's calendar (no tester needed); the picker switches between calendars", async () => {
        answer({ 'GET /api/families/3': FAMILY })
        let store
        await act(async () => { store = setup('/calendar?date=2026-10-19&cal=family-3') })
        withAccess(store, false)
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

    it("a family's entries can be events and remind every member", async () => {
        answer({ 'GET /api/families/3': FAMILY })
        await act(async () => { setup('/calendar?date=2026-10-19&day=2026-10-24&cal=family-3') })
        fireEvent.click(screen.getByRole('button', { name: 'Edit: Grandma visits' }))
        expect(screen.getAllByRole('radio', { name: /Event/ }).length).toBeGreaterThan(0)
        fireEvent.click(screen.getByRole('button', { name: /More options/ }))
        expect(screen.getByText('Reminds every member.')).toBeInTheDocument()
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
    it('opens a day in the calendar; the calendar itself is in the menu, not a card of its own', () => {
        setup('/')
        const link = screen.getByText('Dentist').closest('a')
        expect(link).toHaveAttribute('href', '/calendar?date=2026-10-19&day=2026-10-19')
        expect(screen.queryByRole('link', { name: /^Calendar/ })).not.toBeInTheDocument()
    })
})

describe('the Untis timetable in my calendar', () => {
    const LESSONS = [
        { id: 5, day: '2026-10-19', start: '08:00', end: '09:35', subject: 'M', subjectLong: 'Mathematik', room: 'R12', className: '10b', status: 'normal', info: '' },
        { id: 6, day: '2026-10-19', start: '09:55', end: '10:40', subject: 'E', subjectLong: 'Englisch', room: 'R3', className: '10b', status: 'cancelled', info: 'Entfall' },
    ]
    beforeEach(async () => {
        const { rememberUntisStatus } = await import('../features/untis/untis')
        rememberUntisStatus(null)
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/untis') return { available: true, connected: true, mode: 'login', schoolLabel: 'Gym', username: 'lena' }
            if (url.startsWith('/api/untis/lessons')) return { lessons: LESSONS, lastSyncAt: null }
            return []
        })
    })

    it('shows a day of lessons as one box that opens to the lessons, read-only, a cancelled one marked', async () => {
        await act(async () => { setup('/calendar?date=2026-10-19&day=2026-10-19') })
        await act(async () => {})
        const box = await screen.findByRole('button', { name: /Timetable: 08:00–10:40/ })
        expect(box).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByLabelText('Timetable: Mathematik')).toBeNull()
        fireEvent.click(box)
        const lesson = await screen.findByLabelText('Timetable: Mathematik')
        // no button to open an editor, no way to drag it
        expect(lesson.tagName).toBe('SPAN')
        expect(screen.getByLabelText('Timetable: Englisch')).toHaveTextContent('Cancelled')
        const close = screen.getByRole('button', { name: 'Collapse timetable' })
        expect(close).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(close)
        expect(screen.getByRole('button', { name: /Timetable: 08:00–10:40/ })).toHaveAttribute('aria-expanded', 'false')
        expect(apiFetch.mock.calls.some(([url]) => /^\/api\/untis\/lessons\?from=2026-09-18&to=2026-11-19$/.test(url))).toBe(true)
    })

    it('can be hidden in the filters, and stays out of the agenda and the export', async () => {
        await act(async () => { setup('/calendar?date=2026-10-19&view=agenda') })
        await act(async () => {})
        expect(screen.queryByText('Mathematik')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
        const toggle = screen.getByRole('button', { name: 'Show timetable' })
        expect(toggle).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(toggle)
        expect(localStorage.getItem('untisShow')).toBe('off')
    })
})
