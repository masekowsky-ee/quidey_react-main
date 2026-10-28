import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { setFocusTask } from '../features/session/sessionAction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { readFocusRun, storeFocusRun } from '../features/session/focusRun'
import TimerContainer from '../components/TimerContainer'

// Stopping the timer saves the session, starting it sets the alarm: don't hit a real server
vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn().mockResolvedValue({ id: 1 }),
}))

const taskA = { id: 1, name: 'write report', done: false }
const taskB = { id: 2, name: 'answer mails', done: false }

function renderTimer(focus = null) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [taskA, taskB], groups: [], notes: [] } })
    if (focus) store.dispatch(setFocusTask(focus))
    render(<Provider store={store}><MemoryRouter><TimerContainer /></MemoryRouter></Provider>)
    // folded into the corner button at first
    fireEvent.click(screen.getByRole('button', { name: 'Timer öffnen' }))
    // another task taken into focus while the timer runs (Home, Fokusraum)
    const switchTask = (task) => act(() => { store.dispatch(setFocusTask(task)) })
    return { store, switchTask }
}

const workedTasks = (store) => store.getState().session.currentSessionData.workedTasks

// Let the fake clock run, flushing React updates in between
const advance = async (ms) => {
    for (let i = 0; i < ms / 1000; i++) {
        await act(async () => { vi.advanceTimersByTime(1000) })
    }
}

// The phone is off: no timer runs, only the wall clock moves on. Then the screen comes on again.
const sleepPhone = async (ms) => {
    await act(async () => {
        vi.setSystemTime(Date.now() + ms)
        document.dispatchEvent(new Event('visibilitychange'))
    })
}

describe('TimerContainer', () => {
    beforeEach(() => { vi.useFakeTimers(); apiFetch.mockClear() })
    afterEach(() => { vi.useRealTimers(); localStorage.clear() })

    it('starts folded into a button and keeps running while folded', async () => {
        const store = configureStore({ reducer: rootReducer })
        render(<Provider store={store}><MemoryRouter><TimerContainer /></MemoryRouter></Provider>)
        expect(screen.queryByRole('button', { name: 'start timer' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Timer öffnen' }))
        fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
        fireEvent.click(screen.getByRole('button', { name: 'Timer einklappen' }))
        await advance(2000)

        expect(store.getState().session.timer.time).toBe(30 * 60 * 1000 - 2000)
        expect(screen.getByRole('button', { name: 'Timer öffnen, 00:29:58' })).toBeInTheDocument()
    })

    describe('while the phone is off', () => {
        it('the countdown goes on by the wall clock and the time is booked', async () => {
            const { store } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await advance(1000)

            await sleepPhone(10 * 60 * 1000)

            expect(screen.getByText('00:19:59')).toBeInTheDocument()
            expect(workedTasks(store)).toEqual([{ id: 1, name: 'write report', time: 601 }])
            expect(store.getState().session.currentSessionData.totalTime).toBe(601)
        })

        it('a countdown that ran out meanwhile ends then: time saved, not more than its length', async () => {
            const { store } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))

            await sleepPhone(45 * 60 * 1000)

            expect(store.getState().session.timer).toEqual({ time: 0, active: false })
            expect(apiFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({ method: 'POST' }))
            const sent = JSON.parse(apiFetch.mock.calls.find(call => call[0] === '/api/sessions')[1].body)
            expect(sent.totalTime).toBe(30 * 60)
        })

        it('starting sets the alarm on the server, pausing takes it away', async () => {
            renderTimer()
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            const set = apiFetch.mock.calls.find(call => call[0] === '/api/focus/alarm')
            expect(set[1].method).toBe('PUT')
            expect(JSON.parse(set[1].body)).toEqual({ endsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), phase: 'timer' })

            fireEvent.click(screen.getByRole('button', { name: 'pause timer' }))
            expect(apiFetch).toHaveBeenLastCalledWith('/api/focus/alarm', { method: 'DELETE' })
        })

        it('the running session is written down, so a closed app takes it up again', async () => {
            const { store } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await advance(3000)
            storeFocusRun(store.getState().session)

            const run = readFocusRun()
            expect(run.timer).toEqual({ time: 30 * 60 * 1000 - 3000, active: true })
            expect(run.focusTask).toEqual({ id: 1, name: 'write report' })
            expect(typeof run.runningSince).toBe('number')
        })
    })

    describe('stopwatch', () => {
        it('counts up from zero and books the time on the task', async () => {
            const { store } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'Stoppuhr' }))
            expect(screen.getByText('00:00:00')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await advance(3000)

            expect(screen.getByText('00:00:03')).toBeInTheDocument()
            expect(workedTasks(store)).toEqual([{ id: 1, name: 'write report', time: 3 }])
            expect(localStorage.getItem('timerMode')).toBe('stopwatch')
        })

        it("can't switch the mode while running; stop saves and starts from zero again", async () => {
            renderTimer()
            fireEvent.click(screen.getByRole('button', { name: 'Stoppuhr' }))
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await advance(2000)
            expect(screen.getByRole('button', { name: 'Timer' })).toBeDisabled()

            fireEvent.click(screen.getByRole('button', { name: 'pause timer' }))
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'stop timer' })) })

            expect(screen.getByText('00:00:00')).toBeInTheDocument()
            expect(apiFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({ method: 'POST' }))
            expect(screen.getByRole('button', { name: 'Timer' })).toBeEnabled()
        })
    })

    describe('Pomodoro', () => {
        it('focus, then a short break that books nothing, then focus again', async () => {
            const { store } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'Pomodoro' }))
            expect(screen.getByText('00:25:00')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await sleepPhone(25 * 60 * 1000)

            // the round is saved and the break is ready
            expect(store.getState().session.pomodoro).toMatchObject({ phase: 'short', round: 1 })
            expect(screen.getByText('00:05:00')).toBeInTheDocument()
            expect(screen.getByText('Kurze Pause')).toBeInTheDocument()
            expect(apiFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({ method: 'POST' }))

            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await advance(3000)
            expect(workedTasks(store)).toEqual([])
            await sleepPhone(5 * 60 * 1000)
            expect(store.getState().session.pomodoro).toMatchObject({ phase: 'focus', round: 1 })
            expect(screen.getByText('00:25:00')).toBeInTheDocument()
        })

        it('every fourth round is followed by the long break', async () => {
            const { store } = renderTimer()
            fireEvent.click(screen.getByRole('button', { name: 'Pomodoro' }))
            for (let round = 0; round < 3; round++) {
                fireEvent.click(screen.getByRole('button', { name: 'Zur nächsten Phase' }))
                fireEvent.click(screen.getByRole('button', { name: 'Zur nächsten Phase' }))
            }
            fireEvent.click(screen.getByRole('button', { name: 'Zur nächsten Phase' }))
            expect(store.getState().session.pomodoro).toMatchObject({ phase: 'long', round: 4 })
            expect(screen.getByText('00:15:00')).toBeInTheDocument()
        })
    })

    it('shows the full session length before starting', () => {
        renderTimer()
        expect(screen.getByText('00:30:00')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'start timer' })).toBeInTheDocument()
    })

    it('counts down once per second after start', async () => {
        renderTimer()
        fireEvent.click(screen.getByRole('button', { name: 'start timer' }))

        await advance(3000)

        expect(screen.getByText('00:29:57')).toBeInTheDocument()
    })

    it('moves the progress bar as time passes', async () => {
        const { store } = renderTimer()
        fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
        await advance(3000)
        const { timer, sessionParams } = store.getState().session
        expect(sessionParams.time - timer.time).toBe(3000)
    })

    describe('time per task', () => {
        it('books every running second on the task in focus', async () => {
            const { store } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))

            await advance(3000)

            expect(workedTasks(store)).toEqual([{ id: 1, name: 'write report', time: 3 }])
        })

        it('splits the time between tasks when another one is taken into focus', async () => {
            const { store, switchTask } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await advance(2000)

            switchTask(taskB)
            await advance(3000)

            expect(workedTasks(store)).toEqual([{ id: 1, name: 'write report', time: 2 }, { id: 2, name: 'answer mails', time: 3 }])
        })

        it('switching tasks does not make the countdown drift', async () => {
            const { switchTask } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await act(async () => { vi.advanceTimersByTime(600) })

            switchTask(taskB) // mid-second
            await act(async () => { vi.advanceTimersByTime(400) })

            // still exactly one second after one second in total
            expect(screen.getByText('00:29:59')).toBeInTheDocument()
        })

        it('books nothing while paused', async () => {
            const { store } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await advance(1000)
            fireEvent.click(screen.getByRole('button', { name: 'pause timer' }))

            await advance(5000)
            await sleepPhone(60 * 1000)

            expect(workedTasks(store)[0].time).toBe(1)
        })

        it('books nothing on any task when no task is in focus', async () => {
            const { store } = renderTimer(null)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))

            await advance(3000)

            expect(workedTasks(store)).toEqual([])
            expect(store.getState().session.currentSessionData.totalTime).toBe(3)
        })

        it('a task ticked off elsewhere gets no more time', async () => {
            const { store } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await advance(1000)
            act(() => { store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [{ ...taskA, done: true }, taskB], groups: [], notes: [] } }) })
            await advance(2000)
            expect(workedTasks(store)[0].time).toBe(1)
        })
    })

    it('stops counting while paused', async () => {
        renderTimer()
        fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
        await advance(2000)
        fireEvent.click(screen.getByRole('button', { name: 'pause timer' }))

        await advance(5000)

        expect(screen.getByText('00:29:58')).toBeInTheDocument()
    })

    it('stop ends the session: timer at zero, session saved', async () => {
        renderTimer()
        fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
        await advance(1000)

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'stop timer' })) })

        expect(screen.getByText('00:00:00')).toBeInTheDocument()
        expect(apiFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({ method: 'POST' }))
    })

    it('"set timer" opens the editor filled with the last session length', async () => {
        renderTimer()
        fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'stop timer' })) })

        fireEvent.click(screen.getByRole('button', { name: 'set timer' }))

        // used to show "null : null : null"
        expect(screen.queryByText('null')).not.toBeInTheDocument()
        const [h, m, s] = screen.getAllByRole('heading', { level: 2 })
            .filter(el => /^\d{2}$/.test(el.textContent))
            .map(el => el.textContent)
        expect([h, m, s]).toEqual(['00', '30', '00'])
    })

    it('confirming a new time also makes it the session length', async () => {
        const { store } = renderTimer()
        fireEvent.click(screen.getByText('00:30:00')) // clicking the time opens the editor

        fireEvent.click(screen.getByRole('button', { name: 'confirm time' }))

        const { timer, sessionParams } = store.getState().session
        expect(sessionParams.time).toBe(30 * 60 * 1000)
        expect(timer).toEqual({ time: 30 * 60 * 1000, active: false })
    })
})
