import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { addTask, deleteTask, updateTaskProps } from '../features/tasks/taskAction'
import { saveSessionData, setSessionParams, addWorkedTask, addTaskTime, updateCurrentSessionData } from '../features/session/sessionAction'

// Replace only apiFetch; the formatting helpers stay real
vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const makeStore = () => configureStore({ reducer: rootReducer })
const bodyOf = (call) => JSON.parse(call[1].body)

beforeEach(() => apiFetch.mockReset())

describe('addTask', () => {
    it('creates the task and adds the returned row to the store', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValueOnce({ id: 7, name: 'Write report', due: '2026-10-20', prio: 50 })

        await store.dispatch(addTask('Write report', '2026-10-20', 'desc', '50'))

        expect(apiFetch).toHaveBeenCalledTimes(1)
        expect(apiFetch.mock.calls[0][0]).toBe('/api/tasks')
        expect(bodyOf(apiFetch.mock.calls[0])).toMatchObject({ name: 'Write report', due: '2026-10-20', description: 'desc', prio: '50' })
        expect(store.getState().task.tasks).toEqual([{ id: 7, name: 'Write report', due: '2026-10-20', prio: 50 }])
    })

    it('also links the new task to the group that is currently shown', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValueOnce({ id: 7, name: 'x' }).mockResolvedValueOnce({})

        await store.dispatch(addTask('x', '2026-10-20', '', '50', 10))

        expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/tasks/7/groups/10', { method: 'POST' })
    })

    it('adds nothing to the store when the API rejects it', async () => {
        const store = makeStore()
        apiFetch.mockRejectedValueOnce(new Error('Token invalid or expired'))

        await expect(store.dispatch(addTask('x', '2026-10-20', '', '50'))).rejects.toThrow('Token invalid or expired')
        expect(store.getState().task.tasks).toEqual([])
    })
})

describe('deleteTask', () => {
    it('deletes on the server, then removes the task locally', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValueOnce({ id: 7 })
        await store.dispatch(addTask('x', '2026-10-20', '', '50'))
        apiFetch.mockResolvedValueOnce({ message: 'Task deleted' })

        await store.dispatch(deleteTask(7))

        expect(apiFetch).toHaveBeenLastCalledWith('/api/tasks/7', { method: 'DELETE' })
        expect(store.getState().task.tasks).toEqual([])
    })
})

describe('updateTaskProps', () => {
    it('sends the whole task with the changed fields merged in', async () => {
        const store = makeStore()
        const task = { id: 3, name: 'old', due: '2026-10-20', description: 'd', prio: 50, done: false }
        apiFetch.mockResolvedValueOnce({ ...task, done: true })

        await store.dispatch(updateTaskProps({ done: true }, task))

        expect(apiFetch.mock.calls[0][0]).toBe('/api/tasks/3')
        expect(apiFetch.mock.calls[0][1].method).toBe('PUT')
        expect(bodyOf(apiFetch.mock.calls[0])).toEqual({ ...task, done: true })
    })
})

describe('saveSessionData', () => {
    it('posts the current session with the group from the session settings', async () => {
        const store = makeStore()
        store.dispatch(setSessionParams({ time: 60000, group: 'work' }))
        store.dispatch(addWorkedTask({ id: 1, name: 'a' }))
        store.dispatch(updateCurrentSessionData({ totalTime: 90 }))
        apiFetch.mockResolvedValueOnce({ id: 5, totalTime: 90, workedTasks: [{ id: 1, name: 'a' }], group: 'work' })

        await store.dispatch(saveSessionData())

        expect(apiFetch.mock.calls[0][0]).toBe('/api/sessions')
        expect(bodyOf(apiFetch.mock.calls[0])).toMatchObject({
            totalTime: 90,
            workedTasks: [{ id: 1, name: 'a', time: 0 }],
            group: 'work',
        })
    })

    it('sends the time spent on each task, in seconds', async () => {
        const store = makeStore()
        store.dispatch(addTaskTime({ id: 1, name: 'a' }, 120))
        store.dispatch(addTaskTime({ id: 2, name: 'b' }, 45))
        apiFetch.mockResolvedValueOnce({ id: 5 })

        await store.dispatch(saveSessionData())

        expect(bodyOf(apiFetch.mock.calls[0]).workedTasks).toEqual([
            { id: 1, name: 'a', time: 120 },
            { id: 2, name: 'b', time: 45 },
        ])
    })

    it('falls back to "all" when no group was chosen', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValueOnce({ id: 5 })

        await store.dispatch(saveSessionData())

        expect(bodyOf(apiFetch.mock.calls[0]).group).toBe('all')
    })

    it('adds the saved session to the history and starts a fresh one', async () => {
        const store = makeStore()
        store.dispatch(addWorkedTask({ id: 1, name: 'a' }))
        apiFetch.mockResolvedValueOnce({ id: 5, totalTime: 0 })

        await store.dispatch(saveSessionData())

        const { workedSessionData, currentSessionData } = store.getState().session
        expect(workedSessionData[0]).toEqual({ id: 5, totalTime: 0 })
        expect(currentSessionData.workedTasks).toEqual([])
    })
})
