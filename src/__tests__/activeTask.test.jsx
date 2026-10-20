import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
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
            expect(apiFetch).toHaveBeenCalledWith('/api/tasks/1', expect.objectContaining({ method: 'PUT' }))
        })

        it('stays calm on "normal"', async () => {
            await finish('normal')
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
    it('covers messages, notices, feedback and the completion time', () => {
        render(
            <Provider store={makeStore()}>
                <MemoryRouter initialEntries={['/datenschutz']}><LegalPage /></MemoryRouter>
            </Provider>
        )
        const text = document.body.textContent
        for (const part of ['Nachrichten im Postfach', 'Meldungen:', 'Sendest du in der App Feedback', 'Zeitpunkt, zu dem du sie erledigt hast', 'auch beim Gegenüber']) {
            expect(text).toContain(part)
        }
    })
})
