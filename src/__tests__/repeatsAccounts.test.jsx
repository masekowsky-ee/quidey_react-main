import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { SET_USER } from '../features/auth/authActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import { deleteTaskAsking } from '../features/tasks/taskAction'
import { matchEventType } from '../features/tasks/kinds'
import { projectRepeats, dateKey, addDays } from '../features/calendar/calendar'
import { listAccounts, rememberAccount, forgetAccount, forgetToken, otherAccounts } from '../features/auth/accounts'
import DeleteScopeDialog from '../components/task/DeleteScopeDialog'
import TaskForm from '../components/TaskForm'
import Feedback from '../components/Feedback'
import Profile from '../components/Profile'
import SharedTaskList from '../components/together/SharedTaskList'
import Settings from '../components/Settings'
import Header from '../components/Header'
import QuickAdd from '../components/QuickAdd'
import { LOGIN_SUCCESS } from '../features/auth/authActionTypes'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

function makeStore({ tasks = [], eventTypes = [], language = 'en' } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage(language))
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks, groups: [], notes: [], eventTypes } })
    return store
}

const wrap = (store, ui) => render(<Provider store={store}><MemoryRouter>{ui}</MemoryRouter></Provider>)
const callsTo = (pattern, method) => apiFetch.mock.calls.filter(([url, options]) => pattern.test(url) && (!method || options?.method === method))

beforeEach(() => {
    apiFetch.mockReset()
    apiFetch.mockImplementation(async () => [])
    localStorage.clear()
})

describe('keywords of event types', () => {
    const work = { id: 1, name: 'Arbeit', color: 'blue', position: 0, keywords: ['Arbeit', 'Schicht'] }
    const sport = { id: 2, name: 'Sport', color: 'green', position: 1, keywords: ['Training'] }

    it('a word of the name has to start with a keyword, case aside', () => {
        expect(matchEventType('Arbeit im Café', [work, sport])).toEqual({ type: work, keyword: 'Arbeit' })
        expect(matchEventType('arbeitstreffen', [work])?.type).toBe(work)
        expect(matchEventType('Spät-Schicht', [work])?.keyword).toBe('Schicht')
        expect(matchEventType('Bearbeiten', [work])).toBeNull()
        expect(matchEventType('Training am Abend', [work, sport])?.type).toBe(sport)
        expect(matchEventType('', [work])).toBeNull()
        expect(matchEventType('Arbeit', [{ ...work, keywords: [] }])).toBeNull()
        // characters with a meaning in patterns are just characters
        expect(matchEventType('C++ Kurs', [{ id: 3, name: 'Code', keywords: ['C++'] }])?.type.id).toBe(3)
    })

    it('a new event gets the type its name points to; picking "none" takes it away for good', async () => {
        const store = makeStore({ eventTypes: [work] })
        apiFetch.mockImplementation(async (url, options = {}) => (options.method === 'POST' && url === '/api/tasks' ? { id: 50, ...JSON.parse(options.body) } : []))
        wrap(store, <TaskForm setCreateTask={() => {}} />)

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Arbeit Lager' } })
        // a task offers to become such an event
        fireEvent.click(screen.getByRole('button', { name: /Fits “Arbeit”/ }))
        expect(screen.getByText(/Picked by itself because the name contains “Arbeit”/)).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: 'Arbeit' })).toBeChecked()

        // taken away by hand: it stays away while the name changes
        fireEvent.click(screen.getByRole('radio', { name: 'No type' }))
        fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Arbeit Lager B' } })
        expect(screen.getByRole('radio', { name: 'No type' })).toBeChecked()
    })
})

describe('repeats that end and repeats left out', () => {
    const start = new Date(2026, 9, 5)
    const weekly = { id: 9, name: 'Kurs', due: dateKey(start), repeat: 'weekly', done: false }

    it('previews stop after repeat_left steps and leave skipped days out', () => {
        const until = addDays(start, 70)
        expect(projectRepeats([weekly], until)).toHaveLength(10)
        const ending = projectRepeats([{ ...weekly, repeat_left: 3 }], until)
        expect(ending.map(task => task.due)).toEqual([7, 14, 21].map(n => dateKey(addDays(start, n))))
        const skipped = projectRepeats([{ ...weekly, repeat_left: 3, repeat_skip: [dateKey(addDays(start, 14))] }], until)
        expect(skipped.map(task => task.repeatStep)).toEqual([1, 3])
    })
})

describe('deleting a repeating task asks what goes', () => {
    const series = { id: 12, name: 'Yoga', due: '2026-11-02', repeat: 'weekly', done: false, isOwner: true, group_ids: [] }

    const setup = (tasks) => {
        const store = makeStore({ tasks })
        wrap(store, <DeleteScopeDialog />)
        return store
    }

    it('a plain task goes at once', async () => {
        const store = setup([{ ...series, repeat: null }])
        apiFetch.mockResolvedValueOnce({ deletedIds: [12] })
        let result
        await act(async () => { result = await store.dispatch(deleteTaskAsking({ ...series, repeat: null })) })
        expect(result).toBe(true)
        expect(apiFetch).toHaveBeenCalledWith('/api/tasks/12', { method: 'DELETE' })
        expect(store.getState().task.tasks).toHaveLength(0)
    })

    it('"only this one" hands over to the next one; cancel deletes nothing', async () => {
        const store = setup([series])
        let pending
        act(() => { pending = store.dispatch(deleteTaskAsking(series)) })
        expect(screen.getByRole('alertdialog', { name: 'Delete a repeating task' })).toBeInTheDocument()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Cancel/ })) })
        expect(await pending).toBe(false)
        expect(apiFetch).not.toHaveBeenCalled()

        const next = { ...series, id: 13, due: '2026-11-09' }
        apiFetch.mockResolvedValueOnce({ deletedIds: [12], nextTask: next })
        act(() => { pending = store.dispatch(deleteTaskAsking(series)) })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Only this one/ })) })
        expect(await pending).toBe(true)
        expect(apiFetch).toHaveBeenCalledWith('/api/tasks/12?scope=one', { method: 'DELETE' })
        expect(store.getState().task.tasks.map(task => task.id)).toEqual([13])
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('a coming repeat is named by its day; "all" removes the whole row', async () => {
        const store = setup([series, { ...series, id: 11, done: true, due: '2026-10-26' }])
        const preview = projectRepeats([series], new Date(2026, 10, 20))[1]
        apiFetch.mockResolvedValueOnce({ deletedIds: [], task: { ...series, repeat_left: 1 } })
        let pending
        act(() => { pending = store.dispatch(deleteTaskAsking(preview)) })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /This and all following/ })) })
        await pending
        expect(apiFetch).toHaveBeenLastCalledWith('/api/tasks/12?scope=following&occurrence=2026-11-16', { method: 'DELETE' })
        expect(store.getState().task.tasks.find(task => task.id === 12).repeat_left).toBe(1)

        apiFetch.mockResolvedValueOnce({ deletedIds: [11, 12] })
        act(() => { pending = store.dispatch(deleteTaskAsking(series)) })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /All of them/ })) })
        await pending
        expect(apiFetch).toHaveBeenLastCalledWith('/api/tasks/12?scope=all', { method: 'DELETE' })
        expect(store.getState().task.tasks).toHaveLength(0)
    })
})

describe('several accounts on one device', () => {
    it('remembers each account once, keeps its place and forgets it on sign-out', () => {
        rememberAccount({ username: 'ann', token: 't1' })
        rememberAccount({ username: 'bob', token: 't2', displayName: 'Bob' })
        rememberAccount({ username: 'ANN', token: 't3', displayName: 'Ann' })
        expect(listAccounts()).toEqual([
            { username: 'ANN', token: 't3', displayName: 'Ann' },
            { username: 'bob', token: 't2', displayName: 'Bob' },
        ])
        expect(otherAccounts('ann').map(a => a.username)).toEqual(['bob'])
        forgetToken('t2')
        forgetAccount('ann')
        expect(listAccounts()).toEqual([])
        expect(localStorage.getItem('accounts')).toBeNull()
    })

    it('a broken list is ignored', () => {
        localStorage.setItem('accounts', '{nope')
        expect(listAccounts()).toEqual([])
        localStorage.setItem('accounts', JSON.stringify([{ username: 'x' }, null, { username: 'y', token: 't' }]))
        expect(listAccounts()).toEqual([{ username: 'y', token: 't' }])
    })

    it('signing in remembers the account; the sign-in offers the ones still signed in here', async () => {
        rememberAccount({ username: 'bob', token: 'tb', displayName: 'Bob' })
        const store = makeStore({ language: 'de' })
        apiFetch.mockImplementation(async (url) => (url === '/api/login' ? { token: 'ta', username: 'ann' } : { isPro: true }))
        wrap(store, <Profile />)
        expect(screen.getByText('Auf diesem Gerät angemeldet')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Bob/ })).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Benutzername oder E-Mail'), { target: { value: 'ann' } })
        fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'password123' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Anmelden' })) })
        expect(listAccounts().map(a => a.username)).toEqual(['bob', 'ann'])
    })
})

describe('one click is one request', () => {
    it('signing up twice quickly sends one registration; the button says it is busy', async () => {
        const store = makeStore({ language: 'de' })
        let finish
        apiFetch.mockImplementation(() => new Promise(resolve => { finish = resolve }))
        wrap(store, <Profile initialSignState={1} />)
        const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
        type('E-Mail', 'ann@example.com')
        type('Anzeigename', 'Ann')
        type('Geburtsdatum', '1990-05-01')
        type('Benutzer Name', 'ann')
        type('Passwort', 'password123')
        type('Passwort bestätigen', 'password123')
        for (const name of [/Nutzungsbedingungen/, /Datenschutzerklärung/, /mindestens 14 Jahre/]) fireEvent.click(screen.getByRole('checkbox', { name }))

        const button = screen.getByRole('button', { name: 'Registrieren' })
        fireEvent.click(button)
        fireEvent.click(button)
        fireEvent.submit(button.closest('form'))
        expect(callsTo(/^\/api\/register$/, 'POST')).toHaveLength(1)
        expect(screen.getByRole('button', { name: 'Konto wird erstellt …' })).toBeDisabled()

        await act(async () => { finish({}) })
        expect(screen.getByText(/Bitte bestätige deine E-Mail-Adresse/)).toBeInTheDocument()
    })
})

describe('feedback', () => {
    it('the reply address starts as the account’s and can be changed', async () => {
        const store = makeStore()
        store.dispatch({ type: SET_USER, payload: [{ username: 'ann', display_name: 'Ann', email: 'ann@example.com' }] })
        apiFetch.mockResolvedValue({ sent: true })
        wrap(store, <Feedback />)
        const email = screen.getByLabelText('Reply to')
        expect(email).toHaveValue('ann@example.com')
        fireEvent.change(email, { target: { value: 'private@example.org' } })
        fireEvent.change(screen.getByRole('textbox', { name: 'What would you like?' }), { target: { value: 'More colours please' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Send/ })) })
        expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ category: 'idea', message: 'More colours please', email: 'private@example.org' })
    })
})

describe('events in a shared session', () => {
    const session = {
        id: 4, name: 'Lerngruppe', me: 1, isOwner: true, endedAt: null,
        people: [{ user: { id: 1, username: 'ann', displayName: 'Ann' }, status: 'joined', workingOn: null, totalMs: 0 }],
        tasks: [
            { id: 1, name: 'Folien', kind: 'task', done: false, assignee: null, totalMs: 0, time: [] },
            { id: 2, name: 'Prüfung', kind: 'event', due: '2026-11-03', due_time: '10:00', done: false, assignee: null, totalMs: 0, time: [] },
        ],
        events: [],
    }

    it('an event has no tick, no assignee and no stopwatch; one is added with its day', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue(session)
        wrap(store, <SharedTaskList session={session} />)
        expect(screen.getAllByRole('button', { name: 'Work on this' })).toHaveLength(1)
        expect(screen.getAllByRole('checkbox')).toHaveLength(1)
        expect(screen.getAllByRole('combobox', { name: /^Assign:/ })).toHaveLength(1)

        fireEvent.click(screen.getByRole('radio', { name: 'Event' }))
        fireEvent.change(screen.getByLabelText('New event for everyone'), { target: { value: 'Treffen' } })
        fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-11-05' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })) })
        const [, options] = callsTo(/\/api\/shared-sessions\/4\/tasks$/, 'POST')[0]
        expect(JSON.parse(options.body)).toEqual({ name: 'Treffen', kind: 'event', due: '2026-11-05' })
    })
})

describe('fewer choices at once', () => {
    it('settings come in areas; the link from the editor to the event types opens "planning"', () => {
        const store = makeStore()
        render(<Provider store={store}><MemoryRouter initialEntries={['/settings#event-types']}><Settings /></MemoryRouter></Provider>)
        expect(screen.getByRole('tab', { name: 'Planning' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('heading', { name: 'Event types' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Ocean' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }))
        expect(screen.getByRole('button', { name: 'Ocean' })).toBeInTheDocument()
        expect(window.location.hash).toBe('')
        window.history.replaceState(null, '', '/')
    })

    it('"New" in the header opens the task form from any page; Escape closes it', () => {
        const store = makeStore()
        store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 't', username: 'ann' } })
        wrap(store, <><Header /><QuickAdd /></>)
        expect(screen.queryByRole('heading', { name: 'Create Task' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'New task or event' }))
        expect(screen.getByRole('heading', { name: 'Create Task' })).toBeInTheDocument()
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(screen.queryByRole('heading', { name: 'Create Task' })).not.toBeInTheDocument()
        expect(store.getState().settings.showForms).toBe(false)
    })
})
