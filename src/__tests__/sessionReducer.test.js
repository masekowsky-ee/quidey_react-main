import { describe, it, expect, vi, afterEach } from 'vitest'
import sessionReducer from '../features/session/sessionReducer'
import { setTimer, setSessionParams, addWorkedTask, updateCurrentSessionData, selectTimerProgress } from '../features/session/sessionAction'
import { SAVE_SESSION_DATA, SET_WORKED_SESSIONS } from '../features/session/sessionActionTypes'

const initial = sessionReducer(undefined, { type: '@@INIT' })
const THIRTY_MIN = 30 * 60 * 1000

describe('sessionReducer', () => {
    afterEach(() => vi.useRealTimers())

    it('starts with a stopped 30 minute timer and an empty session', () => {
        expect(initial.timer).toEqual({ time: THIRTY_MIN, active: false })
        expect(initial.sessionParams.time).toBe(THIRTY_MIN)
        expect(initial.currentSessionData).toMatchObject({ totalTime: 0, workedTasks: [], group: 'all' })
        expect(initial.workedSessionData).toEqual([])
    })

    it('SET_TIMER replaces time and running state', () => {
        const state = sessionReducer(initial, setTimer(5000, true))
        expect(state.timer).toEqual({ time: 5000, active: true })
    })

    it('SET_SESSION_PARAMS sets the session length and resets the timer to it, stopped', () => {
        const running = sessionReducer(initial, setTimer(1000, true))
        const state = sessionReducer(running, setSessionParams({ time: 60000, group: 'work' }))
        expect(state.sessionParams).toEqual({ time: 60000, group: 'work' })
        expect(state.timer).toEqual({ time: 60000, active: false })
    })

    it('ADD_WORKED_TASK records a task once, starting at 0 time', () => {
        let state = sessionReducer(initial, addWorkedTask({ id: 1, name: 'write report', prio: 5 }))
        state = sessionReducer(state, addWorkedTask({ id: 1, name: 'write report' }))
        expect(state.currentSessionData.workedTasks).toEqual([{ id: 1, name: 'write report', time: 0 }])
    })

    it('ADD_WORKED_TASK returns the same state for a task that is already recorded', () => {
        const once = sessionReducer(initial, addWorkedTask({ id: 1, name: 'a' }))
        expect(sessionReducer(once, addWorkedTask({ id: 1, name: 'a' }))).toBe(once)
    })

    it('UPDATE_CURRENT_SESSION_DATA merges into the current session', () => {
        const withTask = sessionReducer(initial, addWorkedTask({ id: 1, name: 'a' }))
        const state = sessionReducer(withTask, updateCurrentSessionData({ totalTime: 42 }))
        expect(state.currentSessionData.totalTime).toBe(42)
        expect(state.currentSessionData.workedTasks).toHaveLength(1) // kept
    })

    it('SAVE_SESSION_DATA puts the saved session first and starts a fresh one', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-16T09:00:00Z'))
        const older = { id: 1, totalTime: 60 }
        const saved = { id: 2, totalTime: 120 }
        let state = sessionReducer(initial, { type: SET_WORKED_SESSIONS, payload: [older] })
        state = sessionReducer(state, addWorkedTask({ id: 7, name: 'x' }))
        state = sessionReducer(state, updateCurrentSessionData({ totalTime: 120 }))

        state = sessionReducer(state, { type: SAVE_SESSION_DATA, payload: saved })

        expect(state.workedSessionData).toEqual([saved, older])
        expect(state.currentSessionData).toEqual({ totalTime: 0, workedTasks: [], group: 'all', date: '2026-10-16T09:00:00.000Z' })
    })

    it('SET_WORKED_SESSIONS replaces the history list', () => {
        const state = sessionReducer(initial, { type: SET_WORKED_SESSIONS, payload: [{ id: 9 }] })
        expect(state.workedSessionData).toEqual([{ id: 9 }])
    })
})

describe('selectTimerProgress', () => {
    const progress = (time, total) => selectTimerProgress({ session: { timer: { time }, sessionParams: { time: total } } })

    it('is 0 at the start and 100 at the end', () => {
        expect(progress(THIRTY_MIN, THIRTY_MIN)).toBe(0)
        expect(progress(0, THIRTY_MIN)).toBe(100)
    })

    it('is the elapsed share in between', () => {
        expect(progress(THIRTY_MIN / 4, THIRTY_MIN)).toBe(75)
    })

    it('stays at 0 when the timer is longer than the session length', () => {
        // the bug behind "the bar does not fill": negative progress
        expect(progress(2 * THIRTY_MIN, THIRTY_MIN)).toBe(0)
    })

    it('never goes above 100', () => {
        expect(progress(-1000, THIRTY_MIN)).toBe(100)
    })

    it('is 0 when no session length is set, instead of dividing by zero', () => {
        expect(progress(1000, 0)).toBe(0)
    })
})
