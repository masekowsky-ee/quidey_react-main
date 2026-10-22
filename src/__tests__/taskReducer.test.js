import { describe, it, expect } from 'vitest'
import taskReducer from '../features/tasks/taskReducer'
import {
    SET_TASK_STATE, ADD_TASK, DELETE_TASK, UPDATE_TASK_PROPS, ADD_GROUP, DELETE_GROUP,
    EDIT_DISPLAYGROUP, ADD_GROUP_TASKS, DELETE_GROUP_TASKS, EDIT_GROUP, CREATE_NOTE, DELETE_NOTE, EDIT_NOTE,
} from '../features/tasks/taskActionTypes'

const initial = taskReducer(undefined, { type: '@@INIT' })

const task = (id, extra = {}) => ({
    id, name: `task ${id}`, due: '2026-10-19T22:00:00.000Z', description: '', prio: 50, done: false, ...extra,
})

// State with two tasks, one group and one note, showing all tasks
const loaded = taskReducer(initial, {
    type: SET_TASK_STATE,
    payload: {
        tasks: [task(1), task(2)],
        groups: [{ id: 10, name: 'work', description: 'job stuff' }],
        notes: [{ id: 100, task_id: 1, content: 'first note' }],
    },
})

describe('taskReducer', () => {
    it('starts empty, showing no group', () => {
        expect(initial).toEqual({ tasks: [], groups: [], notes: [], eventTypes: [], groupToDisplay: { group: {}, tasks: [] }, invites: [], invitesLoaded: false })
    })

    it('ignores unknown actions', () => {
        expect(taskReducer(loaded, { type: 'SOMETHING_ELSE' })).toBe(loaded)
    })

    it('SET_TASK_STATE loads everything and shows all tasks', () => {
        expect(loaded.tasks).toHaveLength(2)
        expect(loaded.groups).toHaveLength(1)
        expect(loaded.notes).toHaveLength(1)
        expect(loaded.groupToDisplay.tasks).toEqual(loaded.tasks)
    })

    describe('tasks', () => {
        it('ADD_TASK appends to the task list and the visible list', () => {
            const state = taskReducer(loaded, { type: ADD_TASK, payload: task(3) })
            expect(state.tasks.map(t => t.id)).toEqual([1, 2, 3])
            expect(state.groupToDisplay.tasks.map(t => t.id)).toEqual([1, 2, 3])
        })

        it('DELETE_TASK removes it from both lists', () => {
            const state = taskReducer(loaded, { type: DELETE_TASK, payload: 1 })
            expect(state.tasks.map(t => t.id)).toEqual([2])
            expect(state.groupToDisplay.tasks.map(t => t.id)).toEqual([2])
        })

        it('UPDATE_TASK_PROPS takes the fields the API returned, in both lists', () => {
            const state = taskReducer(loaded, {
                type: UPDATE_TASK_PROPS,
                payload: { ...task(1), name: 'renamed', done: true, prio: 90 },
            })
            const updated = state.tasks.find(t => t.id === 1)
            expect(updated).toMatchObject({ name: 'renamed', done: true, prio: 90 })
            expect(state.groupToDisplay.tasks.find(t => t.id === 1)).toEqual(updated)
            expect(state.tasks.find(t => t.id === 2)).toBe(loaded.tasks[1]) // others untouched
        })

        it('UPDATE_TASK_PROPS keeps old values for fields the payload leaves out', () => {
            const state = taskReducer(loaded, { type: UPDATE_TASK_PROPS, payload: { id: 1, done: true } })
            expect(state.tasks[0]).toMatchObject({ name: 'task 1', due: '2026-10-19T22:00:00.000Z', prio: 50, done: true })
        })

        it('UPDATE_TASK_PROPS works for tasks without a due date', () => {
            // used to crash: the old fallback called task.due.getTime() on null
            const noDue = taskReducer(initial, { type: SET_TASK_STATE, payload: { tasks: [task(5, { due: null })], groups: [], notes: [] } })
            const state = taskReducer(noDue, { type: UPDATE_TASK_PROPS, payload: { id: 5, name: 'still no date' } })
            expect(state.tasks[0]).toMatchObject({ name: 'still no date', due: null })
        })

        it('UPDATE_TASK_PROPS can set done back to false', () => {
            const done = taskReducer(loaded, { type: UPDATE_TASK_PROPS, payload: { id: 1, done: true } })
            const undone = taskReducer(done, { type: UPDATE_TASK_PROPS, payload: { id: 1, done: false } })
            expect(undone.tasks[0].done).toBe(false)
        })
    })

    describe('groups', () => {
        it('ADD_GROUP stores id, name, description and colour', () => {
            const state = taskReducer(loaded, { type: ADD_GROUP, payload: { id: 11, name: 'home', description: 'chores', user_id: 3, color: 'green' } })
            expect(state.groups.at(-1)).toEqual({ id: 11, name: 'home', description: 'chores', color: 'green' })
            const plain = taskReducer(loaded, { type: ADD_GROUP, payload: { id: 12, name: 'work', description: '' } })
            expect(plain.groups.at(-1).color).toBeNull()
        })

        it('EDIT_DISPLAYGROUP shows the given group and its tasks', () => {
            const group = loaded.groups[0]
            const state = taskReducer(loaded, { type: EDIT_DISPLAYGROUP, payload: { group, tasks: [task(2)] } })
            expect(state.groupToDisplay).toEqual({ group, tasks: [task(2)] })
        })

        it('DELETE_GROUP of the shown group falls back to showing all tasks', () => {
            const showing = taskReducer(loaded, { type: EDIT_DISPLAYGROUP, payload: { group: loaded.groups[0], tasks: [task(2)] } })
            const state = taskReducer(showing, { type: DELETE_GROUP, payload: 10 })
            expect(state.groups).toEqual([])
            expect(state.groupToDisplay).toEqual({ group: {}, tasks: loaded.tasks })
        })

        it('DELETE_GROUP of another group leaves the shown list alone', () => {
            const withTwo = taskReducer(loaded, { type: ADD_GROUP, payload: { id: 11, name: 'home' } })
            const showing = taskReducer(withTwo, { type: EDIT_DISPLAYGROUP, payload: { group: withTwo.groups[0], tasks: [task(2)] } })
            const state = taskReducer(showing, { type: DELETE_GROUP, payload: 11 })
            expect(state.groupToDisplay).toEqual(showing.groupToDisplay)
        })

        it('DELETE_GROUP_TASKS removes a task from the shown group only', () => {
            const showing = taskReducer(loaded, { type: EDIT_DISPLAYGROUP, payload: { group: loaded.groups[0], tasks: [task(1), task(2)] } })
            const state = taskReducer(showing, { type: DELETE_GROUP_TASKS, payload: 1 })
            expect(state.groupToDisplay.tasks.map(t => t.id)).toEqual([2])
            expect(state.tasks.map(t => t.id)).toEqual([1, 2]) // the task itself still exists
        })

        it('ADD_GROUP_TASKS / DELETE_GROUP_TASKS update the labels of the list on screen too', () => {
            const showingAll = taskReducer(loaded, { type: EDIT_DISPLAYGROUP, payload: { group: {}, tasks: [task(1), task(2)] } })
            const added = taskReducer(showingAll, { type: ADD_GROUP_TASKS, payload: { taskId: 1, groupId: 10 } })
            expect(added.groupToDisplay.tasks[0].group_ids).toEqual([10])
            expect(added.tasks[0].group_ids).toEqual([10])
            const removed = taskReducer(added, { type: DELETE_GROUP_TASKS, payload: { taskId: 1, groupId: 10 } })
            expect(removed.groupToDisplay.tasks[0].group_ids).toEqual([])
            expect(removed.tasks[0].group_ids).toEqual([])
        })

        it('EDIT_GROUP replaces the group and updates the shown group', () => {
            const edited = { id: 10, name: 'work', description: 'new description' }
            const state = taskReducer(loaded, { type: EDIT_GROUP, payload: edited })
            expect(state.groups).toEqual([edited])
            expect(state.groupToDisplay.group).toEqual(edited)
        })
    })

    describe('notes', () => {
        it('CREATE_NOTE appends the note', () => {
            const state = taskReducer(loaded, { type: CREATE_NOTE, payload: { id: 101, task_id: 1, content: 'second' } })
            expect(state.notes.map(n => n.id)).toEqual([100, 101])
        })

        it('DELETE_NOTE removes it by noteId', () => {
            const state = taskReducer(loaded, { type: DELETE_NOTE, payload: { taskId: 1, noteId: 100 } })
            expect(state.notes).toEqual([])
        })

        it('EDIT_NOTE replaces the note with the row from the API', () => {
            const row = { id: 100, task_id: 1, content: 'edited' }
            const state = taskReducer(loaded, { type: EDIT_NOTE, payload: row })
            expect(state.notes).toEqual([row])
        })
    })

    it('never mutates the previous state', () => {
        const snapshot = structuredClone(loaded)
        taskReducer(loaded, { type: ADD_TASK, payload: task(3) })
        taskReducer(loaded, { type: DELETE_TASK, payload: 1 })
        taskReducer(loaded, { type: UPDATE_TASK_PROPS, payload: { id: 1, done: true } })
        expect(loaded).toEqual(snapshot)
    })
})
