import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import { showToast } from '../features/toast/toast'
import { parseQuickEntry, stripFound } from '../features/tasks/quickParse'
import TaskForm from '../components/TaskForm'
import Toaster from '../components/Toaster'
import CommandPalette from '../components/variants/CommandPalette'
import ShortcutsDialog from '../components/ShortcutsDialog'
import Settings from '../components/Settings'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const bodyOf = (path) => {
    const call = apiFetch.mock.calls.find(([url, options]) => url === path && options?.method === 'POST')
    return call && JSON.parse(call[1].body)
}

// a Wednesday morning
const NOW = new Date(2026, 9, 21, 10, 0)

function makeStore({ tasks = [], isTester = false, language = 'en' } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage(language))
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester, adminPendingCount: 0, betaRequest: null } })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks, groups: [], notes: [] } })
    return store
}

function Where() {
    const { pathname, search, hash } = useLocation()
    return <output data-testid="where">{pathname + search + hash}</output>
}

function wrap(ui, store) {
    return render(
        <Provider store={store}>
            <MemoryRouter initialEntries={['/']}>
                <Routes><Route path="*" element={<>{ui}<Where /></>} /></Routes>
            </MemoryRouter>
        </Provider>
    )
}

beforeEach(() => {
    apiFetch.mockReset()
    apiFetch.mockResolvedValue([])
    localStorage.clear()
})

describe('quick entry: a day, time and priority in the name', () => {
    const parse = (text) => parseQuickEntry(text, NOW)

    it('finds a day, a time and a priority and keeps the rest as the name', () => {
        expect(parse('Übungsblatt morgen 14 Uhr !hoch')).toMatchObject({ name: 'Übungsblatt', due: '2026-10-22', time: '14:00', prio: 80 })
        expect(parse('Mathe am Freitag um 9:30')).toMatchObject({ name: 'Mathe', due: '2026-10-23', time: '09:30', prio: null })
        expect(parse('Call tomorrow 3pm !low')).toMatchObject({ name: 'Call', due: '2026-10-22', time: '15:00', prio: 20 })
        expect(parse('Lesen in 3 Tagen')).toMatchObject({ name: 'Lesen', due: '2026-10-24' })
        expect(parse('Referat übermorgen')).toMatchObject({ name: 'Referat', due: '2026-10-23' })
    })

    it('reads dates, and a passed day without a year as next year', () => {
        expect(parse('Abgabe 24.12.')).toMatchObject({ name: 'Abgabe', due: '2026-12-24' })
        expect(parse('Klausur 3.1.')).toMatchObject({ name: 'Klausur', due: '2027-01-03' })
        expect(parse('Klausur 3.2.27')).toMatchObject({ name: 'Klausur', due: '2027-02-03' })
        // no such day: it stays in the name
        expect(parse('Feier 31.2.')).toMatchObject({ name: 'Feier 31.2.', due: null })
    })

    it('a weekday that is today means today, a time alone means today', () => {
        expect(parse('Mittwoch Sport')).toMatchObject({ name: 'Sport', due: '2026-10-21' })
        expect(parse('14:30 Sprechstunde')).toMatchObject({ name: 'Sprechstunde', due: '2026-10-21', time: '14:30' })
    })

    it('leaves words alone that only look like it', () => {
        expect(parse('Morgenroutine')).toMatchObject({ name: 'Morgenroutine', found: [] })
        expect(parse('Treffen 9 am Bahnhof')).toMatchObject({ time: null })
        expect(parse('Wow!')).toMatchObject({ name: 'Wow!', prio: null })
        // nothing but a day is no task: the text stays the name
        expect(parse('heute')).toMatchObject({ name: 'heute', due: null, found: [] })
    })

    it('strips only the kinds that are taken over', () => {
        const { found } = parse('Essay morgen 14 Uhr')
        expect(stripFound('Essay morgen 14 Uhr', found, ['time'])).toBe('Essay morgen')
        expect(stripFound('Essay morgen 14 Uhr', found, ['due', 'time'])).toBe('Essay')
    })
})

describe('the new-task form takes over what the name says', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
    })
    afterEach(() => vi.useRealTimers())

    const open = (store = makeStore()) => {
        const setCreateTask = vi.fn()
        wrap(<TaskForm setCreateTask={setCreateTask} />, store)
        return setCreateTask
    }
    const create = async () => {
        apiFetch.mockResolvedValueOnce({ id: 40, name: 'Essay' })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })) })
    }

    it('shows what it found and saves it, the name without it', async () => {
        const setCreateTask = open()
        const name = screen.getByRole('textbox', { name: 'Name' })
        expect(name).toHaveFocus()
        fireEvent.change(name, { target: { value: 'Essay tomorrow 14:00 !high' } })
        expect(screen.getByText(/Found: Tomorrow · at 14:00 · high priority/)).toBeInTheDocument()
        expect(screen.getByText(/saved as “Essay”/)).toBeInTheDocument()
        await create()
        expect(bodyOf('/api/tasks')).toMatchObject({ name: 'Essay', due: '2026-10-22', due_time: '14:00', prio: 80 })
        expect(setCreateTask).toHaveBeenCalledWith(false)
    })

    it('a day picked by hand wins; only the time is taken from the name', async () => {
        open()
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Essay morgen 9 Uhr' } })
        fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-10-25' } })
        await create()
        expect(bodyOf('/api/tasks')).toMatchObject({ name: 'Essay morgen', due: '2026-10-25', due_time: '09:00' })
    })

    it('"Ignore" keeps the name as typed', async () => {
        open()
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Essay morgen' } })
        fireEvent.click(screen.getByRole('button', { name: 'Ignore' }))
        expect(screen.queryByText(/Found:/)).toBeNull()
        await create()
        expect(bodyOf('/api/tasks')).toMatchObject({ name: 'Essay morgen', due: null })
    })
})

describe('a toast that can be undone', () => {
    it('runs its action once from the button and goes', async () => {
        const store = makeStore()
        const run = vi.fn()
        wrap(<Toaster />, store)
        await act(async () => { store.dispatch(showToast('“Essay” done', 'info', { action: { label: 'Undo', run } })) })
        expect(screen.getByText('“Essay” done')).toBeInTheDocument()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })) })
        expect(run).toHaveBeenCalledTimes(1)
        expect(store.getState().toast).toHaveLength(0)
    })
})

describe('the command bar for everybody and the keyboard shortcuts', () => {
    const essay = { id: 7, name: 'Essay Statistik', due: new Date(2026, 9, 22).toISOString(), done: false, isOwner: true, sharedWith: [], group_ids: [] }
    const done = { id: 8, name: 'Essay alt', due: null, done: true, isOwner: true, sharedWith: [], group_ids: [] }

    const app = (store) => wrap(<><CommandPalette /><ShortcutsDialog /></>, store)

    it('"/" opens it, typing finds open tasks and Enter opens the task', async () => {
        app(makeStore({ tasks: [essay, done] }))
        await act(async () => { fireEvent.keyDown(document.body, { key: '/' }) })
        const input = screen.getByRole('combobox')
        fireEvent.change(input, { target: { value: 'essay' } })
        // the done one is left out
        const options = screen.getAllByRole('option')
        expect(options).toHaveLength(1)
        expect(options[0]).toHaveTextContent('Essay Statistik')
        await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
        // the task's editor, with its name in the field
        expect(screen.getByDisplayValue('Essay Statistik')).toBeInTheDocument()
    })

    it('has no tester places or variants for somebody who is not a tester', async () => {
        app(makeStore())
        await act(async () => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }) })
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tafel' } })
        expect(screen.queryAllByRole('option')).toHaveLength(0)
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'theme' } })
        expect(screen.getByRole('option', { name: /Dark theme|Light theme/ })).toBeInTheDocument()
    })

    it('N opens the new-task form, G then K goes to the calendar, ? shows the overview', async () => {
        const store = makeStore()
        app(store)
        await act(async () => { fireEvent.keyDown(document.body, { key: 'n' }) })
        expect(store.getState().settings.showForms).toBe(true)
        await act(async () => { fireEvent.keyDown(document.body, { key: 'g' }) })
        await act(async () => { fireEvent.keyDown(document.body, { key: 'k' }) })
        expect(screen.getByTestId('where')).toHaveTextContent('/calendar')
        await act(async () => { fireEvent.keyDown(document.body, { key: '?' }) })
        const overview = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
        expect(overview).toHaveTextContent('Go to the calendar')
        await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('finds tabs and settings once something is typed, with where they sit', async () => {
        app(makeStore())
        await act(async () => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }) })
        expect(screen.queryByRole('option', { name: /Accent colour/ })).toBeNull()
        const input = screen.getByRole('combobox')
        // the same name on two pages, told apart by where it sits
        fireEvent.change(input, { target: { value: 'requests' } })
        expect(screen.getByRole('option', { name: 'Requests, Inbox' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Requests, Friends' })).toBeInTheDocument()
        // the admin's tabs only for admins
        expect(screen.getAllByRole('option')).toHaveLength(2)
        // where it sits is searched too
        fireEvent.change(input, { target: { value: 'statistics sessions' } })
        expect(screen.getAllByRole('option')).toHaveLength(1)
        fireEvent.change(input, { target: { value: 'accent' } })
        expect(screen.getByRole('option', { name: 'Accent colour, Settings · Appearance' })).toBeInTheDocument()
        await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
        expect(screen.getByTestId('where')).toHaveTextContent('/settings#appearance')
    })

    it('opens the area of a setting while the settings are open', async () => {
        render(
            <Provider store={makeStore()}>
                <MemoryRouter initialEntries={['/settings']}>
                    <Routes><Route path="*" element={<><CommandPalette /><Settings /></>} /></Routes>
                </MemoryRouter>
            </Provider>
        )
        expect(screen.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true')
        await act(async () => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }) })
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'notifications' } })
        await act(async () => { fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' }) })
        expect(screen.getByRole('tab', { name: 'App' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    })

    it('closes with its cross', async () => {
        app(makeStore())
        await act(async () => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }) })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Close' })) })
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('stays out of the way while typing', async () => {
        const store = makeStore()
        wrap(<><ShortcutsDialog /><input aria-label="Notiz" /></>, store)
        await act(async () => { fireEvent.keyDown(screen.getByRole('textbox', { name: 'Notiz' }), { key: 'n' }) })
        expect(store.getState().settings.showForms).toBe(false)
    })
})
