import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within, renderHook, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE, ADD_GROUP_TASKS, DELETE_GROUP_TASKS, DELETE_GROUP } from '../features/tasks/taskActionTypes'
import { SET_MY_SHARED_TASKS, SET_SHARED_SESSION, SHARED_SESSION_GONE } from '../features/together/togetherActionTypes'
import { selectSharedGroups, selectSharedSoloTasks, isSharedTaskId, sharedTaskIdOf } from '../features/together/togetherAction'
import { saveSessionData, addTaskTime, setTimer, setTimerMode, setFocusTask, startFocus } from '../features/session/sessionAction'
import { SET_POMODORO } from '../features/session/sessionActionTypes'
import { useLinkedWork, workOnSharedTask, dropSharedFocus } from '../features/together/linkedWork'
import { startWork } from '../features/together/work'
import { WORKED_SESSIONS_FIXTURE } from './fixtures/history.js'
import GroupPicker from '../components/GroupPicker'
import TaskContainer from '../components/TaskContainer'
import GroupBtnContainer from '../components/GroupBtnContainer'
import Stats from '../components/Stats'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const ben = { id: 2, username: 'ben', displayName: 'Ben' }
const groups = [{ id: 1, name: 'Uni', description: '' }, { id: 2, name: 'Home', description: 'chores' }]
const ownTasks = [
    { id: 10, name: 'Own task', done: false, due: null, prio: 1, description: null, group_ids: [1] },
    { id: 12, name: 'Lonely', done: false, due: null, prio: 1, description: null, group_ids: [] },
]
// session 5 has a task with id 12, the same number as an own task
const mine = [{ id: 5, name: 'Lerngruppe', me: 1, tasks: [
    { id: 12, name: 'Slides', description: 'for friday', done: false, assignee: ben, myMs: 90000, totalMs: 200000 },
    { id: 13, name: 'Done one', description: null, done: true, assignee: null, myMs: 0, totalMs: 0 },
] }]

function makeStore() {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks: ownTasks, groups, notes: [] } })
    store.dispatch({ type: SET_MY_SHARED_TASKS, payload: mine })
    return store
}

beforeEach(() => { apiFetch.mockReset() })

describe('shared sessions as groups', () => {
    it('one group per session, with "shared-" ids that never clash with own tasks', () => {
        const state = makeStore().getState()
        const [group] = selectSharedGroups(state)
        expect(group).toMatchObject({ id: 'session-5', name: 'Lerngruppe', sessionId: 5, shared: true })
        expect(group.tasks[0]).toMatchObject({ id: 'shared-12', name: 'Slides', myMs: 90000, shared: { sessionId: 5, sessionName: 'Lerngruppe', taskId: 12 } })
        expect(selectSharedSoloTasks(state)).toHaveLength(2)
        expect(isSharedTaskId('shared-12')).toBe(true)
        expect(isSharedTaskId(12)).toBe(false)
        expect(sharedTaskIdOf('shared-12')).toBe(12)
    })

    it('stays current with the session page, and goes away when the session does', () => {
        const store = makeStore()
        store.dispatch({ type: SET_SHARED_SESSION, payload: { seq: 1, session: {
            id: 5, name: 'Renamed', me: 1, endedAt: null, people: [], events: [],
            tasks: [{ id: 12, name: 'Slides v2', description: null, done: true, assignee: null, totalMs: 1, time: [{ userId: 1, ms: 120000 }] }],
        } } })
        expect(selectSharedGroups(store.getState())[0]).toMatchObject({ name: 'Renamed', tasks: [{ name: 'Slides v2', done: true, myMs: 120000 }] })

        store.dispatch({ type: SET_SHARED_SESSION, payload: { seq: 2, session: { id: 5, name: 'Renamed', me: 1, endedAt: '2026-10-19T10:00:00Z', people: [], events: [], tasks: [] } } })
        expect(selectSharedGroups(store.getState())).toEqual([])

        const again = makeStore()
        again.dispatch({ type: SHARED_SESSION_GONE, payload: 5 })
        expect(selectSharedGroups(again.getState())).toEqual([])
    })
})

describe('group labels in the store', () => {
    it('follow adding to and removing from groups', () => {
        const store = makeStore()
        store.dispatch({ type: ADD_GROUP_TASKS, payload: { taskId: 12, groupId: 2 } })
        store.dispatch({ type: ADD_GROUP_TASKS, payload: { taskId: 12, groupId: 2 } })
        expect(store.getState().task.tasks.find(t => t.id === 12).group_ids).toEqual([2])
        store.dispatch({ type: DELETE_GROUP_TASKS, payload: { taskId: 10, groupId: 1 } })
        expect(store.getState().task.tasks.find(t => t.id === 10).group_ids).toEqual([])
        store.dispatch({ type: DELETE_GROUP, payload: 2 })
        expect(store.getState().task.tasks.find(t => t.id === 12).group_ids).toEqual([])
    })
})

describe('solo sessions with shared tasks', () => {
    it('sends shared tasks by their own id, so they never book on an own task', async () => {
        const store = makeStore()
        store.dispatch(addTaskTime({ id: 10, name: 'Own task' }, 30))
        store.dispatch(addTaskTime({ id: 'shared-12', name: 'Slides' }, 60))
        apiFetch.mockResolvedValue({ id: 1, totalTime: 90, workedTasks: [], group: 'all', date: '' })
        await store.dispatch(saveSessionData())
        const body = JSON.parse(apiFetch.mock.calls[0][1].body)
        expect(body.workedTasks).toEqual([
            { id: 10, name: 'Own task', time: 30 },
            { sharedTaskId: 12, name: 'Slides', time: 60 },
        ])
    })

    // like App: the link between the focus timer and the session's stopwatch
    const renderLink = (store) => renderHook(() => useLinkedWork(), { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> })
    const session5 = { id: 5, name: 'Lerngruppe', me: 1 }
    const slides = { id: 12, name: 'Slides', myMs: 90000 }

    it('the focus timer on a session task runs the session stopwatch, an own task stops it', async () => {
        const store = makeStore()
        // the server answers with the session as it is now (the task still there)
        apiFetch.mockResolvedValue({ id: 5, name: 'Lerngruppe', me: 1, endedAt: null, people: [], events: [],
            tasks: [{ id: 12, name: 'Slides', description: null, done: false, assignee: null, totalMs: 200000, time: [{ userId: 1, ms: 90000 }] }] })
        const shared = selectSharedSoloTasks(store.getState())[0]
        renderLink(store)
        store.dispatch(setTimerMode('timer'))
        await act(async () => { store.dispatch(setFocusTask(shared)) })
        expect(apiFetch).not.toHaveBeenCalled() // timer not running yet
        await act(async () => { store.dispatch(setTimer(60000, true)) })
        expect(apiFetch).toHaveBeenLastCalledWith('/api/shared-sessions/5/activity', expect.objectContaining({ body: JSON.stringify({ currentTaskId: 12 }) }))
        expect(store.getState().together.work).toMatchObject({ sessionId: 5, taskId: 12, baseMs: 90000 })

        await act(async () => { store.dispatch(setFocusTask(ownTasks[0])) })
        expect(store.getState().together.work.taskId).toBeNull()
        await act(async () => { store.dispatch(setFocusTask(shared)) })
        expect(store.getState().together.work.taskId).toBe(12)
        await act(async () => { store.dispatch(setTimer(30000, false)) })
        expect(store.getState().together.work.taskId).toBeNull()
    })

    it('a Pomodoro break pauses the session stopwatch', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue({})
        renderLink(store)
        store.dispatch(setTimerMode('pomodoro'))
        await act(async () => { store.dispatch(setFocusTask(selectSharedSoloTasks(store.getState())[0])) })
        await act(async () => { store.dispatch({ type: SET_POMODORO, payload: { phase: 'short', round: 1 } }) })
        await act(async () => { store.dispatch(setTimer(300000, true)) })
        expect(store.getState().together.work.taskId).toBeNull()
        await act(async () => { store.dispatch({ type: SET_POMODORO, payload: { phase: 'focus', round: 1 } }) })
        expect(store.getState().together.work.taskId).toBe(12)
    })

    it('"Daran arbeiten" in a session picks the task in the focus timer and starts it', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue({})
        renderLink(store)
        store.dispatch(setTimerMode('timer'))
        await act(async () => { await store.dispatch(workOnSharedTask(session5, slides)) })
        expect(store.getState().session.focusTask).toMatchObject({ id: 'shared-12', name: 'Slides', shared: { sessionId: 5, taskId: 12 } })
        expect(store.getState().session.timer.active).toBe(true)
        expect(store.getState().together.work).toMatchObject({ sessionId: 5, taskId: 12 })
    })

    it('switching to a session task while the timer runs books the time so far on the old task', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-11-09T10:00:00Z'))
        const store = makeStore()
        apiFetch.mockResolvedValue({})
        renderLink(store)
        store.dispatch(setTimerMode('stopwatch'))
        store.dispatch(setFocusTask(ownTasks[0]))
        store.dispatch(startFocus())
        vi.setSystemTime(new Date('2026-11-09T10:02:00Z'))
        await act(async () => { await store.dispatch(workOnSharedTask(session5, slides)) })
        const worked = store.getState().session.currentSessionData.workedTasks
        expect(worked.find(t => t.id === 10).time).toBe(120)
        expect(store.getState().session.timer.active).toBe(true)
        expect(store.getState().together.work.taskId).toBe(12)
        vi.useRealTimers()
    })

    it('the session stopwatch never runs on its own beside the focus timer', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue({})
        renderLink(store)
        store.dispatch(setTimerMode('timer'))
        await act(async () => { store.dispatch(setFocusTask(ownTasks[0])) })
        await act(async () => { store.dispatch(setTimer(60000, true)) })
        await act(async () => { await store.dispatch(startWork(session5, slides)) })
        expect(store.getState().together.work.taskId).toBeNull()
    })

    it('ticking off or leaving the session takes its task out of the focus timer, the timer runs on', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue({})
        renderLink(store)
        store.dispatch(setTimerMode('timer'))
        await act(async () => { await store.dispatch(workOnSharedTask(session5, slides)) })
        await act(async () => { store.dispatch(dropSharedFocus(5, 99)) })
        expect(store.getState().session.focusTask.id).toBe('shared-12') // another task: stays
        await act(async () => { store.dispatch(dropSharedFocus(5, 12)) })
        expect(store.getState().session.focusTask).toBeNull()
        expect(store.getState().session.timer.active).toBe(true)
        expect(store.getState().together.work.taskId).toBeNull()

        await act(async () => { await store.dispatch(workOnSharedTask(session5, slides)) })
        await act(async () => { store.dispatch(dropSharedFocus(5)) }) // the whole session
        expect(store.getState().session.focusTask).toBeNull()
    })
})

describe('group picker', () => {
    function renderPicker(store, onClose = vi.fn()) {
        render(<Provider store={store}><GroupPicker task={ownTasks[0]} onClose={onClose} /></Provider>)
        return onClose
    }

    it('ticks the groups the task is in and toggles them', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue({})
        renderPicker(store)
        const uni = screen.getByRole('button', { name: /Uni/ })
        const home = screen.getByRole('button', { name: /Home/ })
        expect(uni).toHaveAttribute('aria-pressed', 'true')
        expect(home).toHaveAttribute('aria-pressed', 'false')

        await act(async () => { fireEvent.click(home) })
        expect(apiFetch).toHaveBeenCalledWith('/api/tasks/10/groups/2', { method: 'POST' })
        expect(screen.getByRole('button', { name: /Home/ })).toHaveAttribute('aria-pressed', 'true')

        await act(async () => { fireEvent.click(uni) })
        expect(apiFetch).toHaveBeenCalledWith('/api/task-groups/10/1', { method: 'DELETE' })
        expect(store.getState().task.tasks.find(t => t.id === 10).group_ids).toEqual([2])
    })

    it('creates a new group and puts the task in it', async () => {
        const store = makeStore()
        apiFetch.mockImplementation(async (url) => url === '/api/groups' ? { id: 9, name: 'Sport', description: '' } : {})
        renderPicker(store)
        fireEvent.change(screen.getByPlaceholderText('Neue Gruppe…'), { target: { value: 'Sport' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' })) })
        expect(apiFetch).toHaveBeenCalledWith('/api/tasks/10/groups/9', { method: 'POST' })
        expect(store.getState().task.tasks.find(t => t.id === 10).group_ids).toEqual([1, 9])
    })

    it('closes with Escape, the close button and a click next to it', () => {
        const store = makeStore()
        const onClose = renderPicker(store)
        fireEvent.keyDown(window, { key: 'Escape' })
        fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
        fireEvent.pointerDown(screen.getByRole('dialog').parentElement)
        expect(onClose).toHaveBeenCalledTimes(3)
    })
})

describe('solo task list', () => {
    function renderList(store) {
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <GroupBtnContainer setCreateGroup={() => {}} />
                    <TaskContainer working={false} handlePointerDown={() => {}} setCreateTask={() => {}} activeTask={null} />
                </MemoryRouter>
            </Provider>
        )
    }

    it('shows shared tasks with their session label, read-only, next to own tasks with group labels', () => {
        const store = makeStore()
        renderList(store)
        const slides = screen.getByText('Slides').closest('li')
        expect(within(slides).getByRole('button', { name: /Lerngruppe/ })).toBeInTheDocument()
        expect(within(slides).getByText('→ Ben')).toBeInTheDocument()
        expect(within(slides).getByText('1 min')).toBeInTheDocument() // my time in the session
        expect(within(slides).queryByText('Zu Gruppe hinzufügen')).not.toBeInTheDocument()
        expect(within(slides).getByRole('link', { name: 'Sitzung öffnen' })).toHaveAttribute('href', '/together/5')

        const own = screen.getByText('Own task').closest('li')
        expect(within(own).getByRole('button', { name: 'Uni' })).toBeInTheDocument()
    })

    it('takes the shared tasks out of "All" and brings them back; the choice is remembered', async () => {
        localStorage.removeItem('showSharedTasks')
        const store = makeStore()
        renderList(store)
        expect(screen.getByText('Slides')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Aufgaben aus gemeinsamen Sitzungen ausblenden' }))
        // the row leaves with its exit animation
        await waitFor(() => expect(screen.queryByText('Slides')).not.toBeInTheDocument())
        expect(screen.getByText('Own task')).toBeInTheDocument()
        // only the open one counts
        expect(screen.getByText('1 Aufgaben aus gemeinsamen Sitzungen ausgeblendet')).toBeInTheDocument()
        expect(localStorage.getItem('showSharedTasks')).toBe('0')

        // the session's own group still shows them
        apiFetch.mockResolvedValue({ id: 5, name: 'Lerngruppe', me: 1, endedAt: null, people: [], events: [], tasks: [] })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Lerngruppe\s*1/ })) })
        expect(screen.getByText('Slides')).toBeInTheDocument()
        apiFetch.mockResolvedValue(ownTasks)
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Alle' })) })

        fireEvent.click(screen.getByRole('button', { name: 'Einblenden' }))
        expect(screen.getByText('Slides')).toBeInTheDocument()
        expect(localStorage.getItem('showSharedTasks')).toBe('1')
    })

    it('a session group has no delete button, shows only its tasks, and marks them done in the session', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue({ id: 5, name: 'Lerngruppe', me: 1, endedAt: null, people: [], events: [], tasks: [] })
        renderList(store)
        const groupButton = screen.getByRole('button', { name: /Lerngruppe\s*1/ })
        expect(groupButton.parentElement.querySelector('svg[class*=deleteIcon]')).toBeNull()

        await act(async () => { fireEvent.click(groupButton) })
        expect(screen.queryByText('Own task')).not.toBeInTheDocument()
        expect(screen.getByText(/Deine Zeit daran wird in der Sitzung erfasst/)).toBeInTheDocument()

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Als erledigt markieren: Slides' })) })
        expect(apiFetch).toHaveBeenCalledWith('/api/shared-sessions/5/tasks/12', { method: 'PATCH', body: JSON.stringify({ done: true }) })
    })

    it('opens the group picker and closes it with Escape', async () => {
        const store = makeStore()
        renderList(store)
        // groups are picked from the task's editor
        fireEvent.click(within(screen.getByText('Own task').closest('li')).getByRole('button', { name: 'Bearbeiten: Own task' }))
        fireEvent.click(within(screen.getByRole('dialog')).getByText('Zu Gruppe hinzufügen'))
        expect(screen.getAllByRole('dialog')).toHaveLength(2)
        // Escape closes the picker, the editor stays
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })
})

describe('sessions in the statistics', () => {
    it('shows work in shared sessions with a label, and shared tasks inside solo sessions', async () => {
        const store = makeStore()
        store.dispatch({ type: 'SET_WORKED_SESSIONS', payload: WORKED_SESSIONS_FIXTURE })
        apiFetch.mockResolvedValue([
            { id: 5, name: 'Lerngruppe', endedAt: null, lastWorkedAt: '2026-10-19T09:00:00Z', myMs: 900000, tasks: [{ id: 12, name: 'Slides', done: false, ms: 900000 }] },
        ])
        await act(async () => {
            render(<Provider store={store}><MemoryRouter initialEntries={['/stats?tab=sessions&range=all']}><Stats /></MemoryRouter></Provider>)
        })
        expect(apiFetch).toHaveBeenCalledWith('/api/shared-sessions/history')
        const entry = screen.getByRole('link', { name: 'Lerngruppe' }).closest('li')
        expect(within(entry).getByText('Gemeinsame Sitzung')).toBeInTheDocument()
        expect(within(entry).getByText('15 min', { selector: '[class*=duration]' })).toBeInTheDocument()
        // the stat for team time
        expect(screen.getByText('Gemeinsam').previousSibling).toHaveTextContent('15 min')
        // a solo session with a shared task: tagged with the session's name
        const tag = screen.getByTitle('Gemeinsame Sitzung: Lerngruppe')
        expect(tag).toHaveTextContent('Slides')
    })
})
