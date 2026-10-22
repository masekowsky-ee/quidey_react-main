import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { setMotion } from '../features/settings/settingsAction'
import WorkingContainer from '../components/WorkingContainer'
import TaskContainer from '../components/TaskContainer'
import CompletedTasks from '../components/CompletedTasks'
import Home from '../components/Home'
import LegalPage from '../legal/LegalPage'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const tasks = [
    { id: 1, name: 'Erste', done: false, due: null, prio: 50, description: null, group_ids: [] },
    { id: 2, name: 'Zweite', done: false, due: null, prio: 50, description: null, group_ids: [] },
    { id: 3, name: 'Dritte', done: false, due: null, prio: 50, description: null, group_ids: [] },
]

function makeStore(list = tasks) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks: list, groups: [], notes: [] } })
    return store
}

const wrap = (store, ui) => render(<Provider store={store}><MemoryRouter>{ui}</MemoryRouter></Provider>)

beforeEach(() => { apiFetch.mockReset(); localStorage.clear() })

describe('the task in focus', () => {
    it('can be put back without finishing it', () => {
        const onRelease = vi.fn()
        wrap(makeStore(), <WorkingContainer activeTask={tasks[0]} setActiveTask={vi.fn()} onRelease={onRelease} dropZoneRef={{ current: null }} />)
        fireEvent.click(screen.getByRole('button', { name: 'Zurücklegen (nicht erledigt)' }))
        expect(onRelease).toHaveBeenCalled()
        // nothing was marked done
        expect(apiFetch).not.toHaveBeenCalled()
    })

    it('a put-back task is listed last, the latest one at the very end', () => {
        wrap(makeStore(), <TaskContainer releasedIds={[1]} working={false} handlePointerDown={vi.fn()} setCreateTask={vi.fn()} />)
        const names = within(screen.getAllByRole('list')[0]).getAllByText(/Erste|Zweite|Dritte/).map(el => el.textContent)
        expect(names).toEqual(['Zweite', 'Dritte', 'Erste'])
    })

    describe('on the home page', () => {
        const list = [
            { ...tasks[0], name: 'Fertig', done: true },
            { ...tasks[1], name: 'Offen' },
        ]
        const renderHome = (store) => wrap(store, <Home t={(key) => key} setCustomError={vi.fn()} setActiveTimer={vi.fn()} />)

        it('never starts with a task that is already done', () => {
            apiFetch.mockResolvedValue([])
            renderHome(makeStore(list))
            expect(screen.queryByText('Fertig')).toBeNull()
            expect(screen.getByRole('button', { name: 'Als erledigt markieren' })).toBeInTheDocument()
        })

        it('lets go of the task once the list says it is done', () => {
            apiFetch.mockResolvedValue([])
            const store = makeStore([list[1]])
            renderHome(store)
            expect(screen.getByRole('button', { name: 'Als erledigt markieren' })).toBeInTheDocument()
            // finished somewhere else (calendar, another device)
            act(() => { store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [{ ...list[1], done: true }], groups: [], notes: [] } }) })
            expect(screen.queryByRole('button', { name: 'Als erledigt markieren' })).toBeNull()
        })
    })

    describe('confetti when it is done', () => {
        let animate
        beforeEach(() => {
            // jsdom has no Web Animations API; the confetti needs it
            animate = vi.fn(() => ({}))
            Element.prototype.animate = animate
        })
        afterEach(() => {
            delete Element.prototype.animate
            document.querySelectorAll('body > span').forEach(el => el.remove())
        })

        const finish = async (level) => {
            const store = makeStore()
            store.dispatch(setMotion(level))
            apiFetch.mockResolvedValue({ ...tasks[0], done: true })
            wrap(store, <WorkingContainer activeTask={tasks[0]} setActiveTask={vi.fn()} onRelease={vi.fn()} dropZoneRef={{ current: null }} />)
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Als erledigt markieren' })) })
        }

        it('bursts on "extreme"', async () => {
            await finish('extreme')
            expect(animate.mock.calls.length).toBeGreaterThanOrEqual(60)
            // the second burst follows a moment later
            await waitFor(() => expect(animate).toHaveBeenCalledTimes(100))
            expect(apiFetch).toHaveBeenCalledWith('/api/tasks/1', expect.objectContaining({ method: 'PUT' }))
        })

        it('bursts a little on "normal"', async () => {
            await finish('normal')
            expect(animate).toHaveBeenCalledTimes(30)
        })

        it('stays calm on "minimal"', async () => {
            await finish('minimal')
            expect(animate).not.toHaveBeenCalled()
        })
    })
})

describe('completed tasks folder', () => {
    it('reopens a task', async () => {
        const done = { id: 5, name: 'Steuer', done: true, completed_at: '2026-10-18T09:30:00Z', due: null, prio: 50 }
        const store = makeStore([done])
        apiFetch.mockResolvedValueOnce({ ...done, done: false, completed_at: null })
        wrap(store, <CompletedTasks />)
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Wieder öffnen: Steuer' })) })
        expect(JSON.parse(apiFetch.mock.calls[0][1].body).done).toBe(false)
        expect(store.getState().task.tasks[0]).toMatchObject({ done: false, completed_at: null })
    })
})

describe('privacy policy', () => {
    it('covers messages, notices, feedback, the completion time, events and their types', () => {
        render(
            <Provider store={makeStore()}>
                <MemoryRouter initialEntries={['/datenschutz']}><LegalPage /></MemoryRouter>
            </Provider>
        )
        const text = document.body.textContent.replace(/\s+/g, ' ')
        for (const part of ['Nachrichten im Postfach', 'Meldungen:', 'Sendest du in der App Feedback', 'Zeitpunkt, zu dem sie erledigt bzw. vorbei waren',
            'deine Event-Typen', 'Die Event-Zeit pro Typ siehst nur du', 'auch beim Gegenüber']) {
            expect(text).toContain(part)
        }
    })
})

describe('editing a task on Home', () => {
    const home = (store) => wrap(store, <TaskContainer working={false} handlePointerDown={vi.fn()} setCreateTask={vi.fn()} />)

    it('opens the full editor and saves every field with it', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue({ ...tasks[0], name: 'Erste neu' })
        home(store)
        fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Erste' }))
        const dialog = screen.getByRole('dialog', { name: 'Bearbeiten' })
        // the same editor as in the calendar, with its extra options
        expect(within(dialog).getByRole('button', { name: /Weitere Optionen/ })).toBeTruthy()
        const name = within(dialog).getByLabelText('Name')
        fireEvent.change(name, { target: { value: 'Erste neu' } })
        fireEvent.change(dialog.querySelector('input[type="date"]'), { target: { value: '2026-10-22' } })
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' })) })
        expect(apiFetch).toHaveBeenCalledWith('/api/tasks/1', expect.objectContaining({ method: 'PUT' }))
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('closes with Escape without saving', () => {
        home(makeStore())
        fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Zweite' }))
        fireEvent.keyDown(screen.getByRole('dialog').querySelector('input'), { key: 'Escape' })
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(apiFetch).not.toHaveBeenCalled()
    })

    it('a row stays short: colour, groups and description are set in the editor', () => {
        home(makeStore())
        const row = screen.getByText('Erste').closest('li')
        expect(within(row).queryByRole('button', { name: /^Farbe/ })).toBeNull()
        expect(within(row).queryByText('Zu Gruppe hinzufügen')).toBeNull()
        expect(within(row).queryByRole('spinbutton')).toBeNull()
        fireEvent.click(within(row).getByRole('button', { name: 'Bearbeiten: Erste' }))
        const dialog = screen.getByRole('dialog', { name: 'Bearbeiten' })
        expect(within(dialog).getByRole('radio', { name: 'Türkis' })).toBeInTheDocument()
        expect(within(dialog).getByText('Zu Gruppe hinzufügen')).toBeInTheDocument()
    })

    it('deletes a task only on the second click', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue({})
        home(store)
        const remove = screen.getByRole('button', { name: 'Löschen: Zweite' })
        fireEvent.click(remove)
        expect(apiFetch).not.toHaveBeenCalled()
        expect(remove).toHaveTextContent('Wirklich löschen?')
        await act(async () => { fireEvent.click(remove) })
        expect(apiFetch).toHaveBeenCalledWith('/api/tasks/2', { method: 'DELETE' })
    })
})
