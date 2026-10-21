import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import TimerContainer from '../components/TimerContainer'

// Stopping the timer saves the session; don't hit a real server
vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn().mockResolvedValue({ id: 1 }),
}))

function renderTimer(activeTask = null) {
    const store = configureStore({ reducer: rootReducer })
    const props = { setActiveTimer: vi.fn(), setWorkedTime: vi.fn(), activeTask }
    const ui = (task) => <Provider store={store}><TimerContainer {...props} activeTask={task} /></Provider>
    const view = render(ui(activeTask))
    // folded into the corner button at first
    fireEvent.click(screen.getByRole('button', { name: 'Timer öffnen' }))
    // dropping another task into the work area while the timer runs
    const switchTask = (task) => view.rerender(ui(task))
    return { store, props, switchTask }
}

const workedTasks = (store) => store.getState().session.currentSessionData.workedTasks
const taskA = { id: 1, name: 'write report' }
const taskB = { id: 2, name: 'answer mails' }

// Let the fake clock run, flushing React updates in between
const advance = async (ms) => {
    for (let i = 0; i < ms / 1000; i++) {
        await act(async () => { vi.advanceTimersByTime(1000) })
    }
}

describe('TimerContainer', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => { vi.useRealTimers(); localStorage.clear() })

    it('starts folded into a button and keeps running while folded', async () => {
        const store = configureStore({ reducer: rootReducer })
        const props = { setActiveTimer: vi.fn(), setWorkedTime: vi.fn(), activeTask: null }
        render(<Provider store={store}><TimerContainer {...props} /></Provider>)
        expect(screen.queryByRole('button', { name: 'start timer' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Timer öffnen' }))
        fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
        fireEvent.click(screen.getByRole('button', { name: 'Timer einklappen' }))
        await advance(2000)

        expect(store.getState().session.timer.time).toBe(30 * 60 * 1000 - 2000)
        expect(screen.getByRole('button', { name: 'Timer öffnen, 00:29:58' })).toBeInTheDocument()
    })

    describe('stopwatch', () => {
        it('counts up from zero and books the time on the task', async () => {
            const { store } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'Stoppuhr' }))
            expect(screen.getByText('00:00:00')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await advance(3000)

            expect(screen.getByText('00:00:03')).toBeInTheDocument()
            expect(workedTasks(store)).toEqual([{ ...taskA, time: 3 }])
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

    it('shows the full session length before starting', () => {
        renderTimer()
        expect(screen.getByText('00:30:00')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'start timer' })).toBeInTheDocument()
    })

    it('counts down once per second after start', async () => {
        const { props } = renderTimer()
        fireEvent.click(screen.getByRole('button', { name: 'start timer' }))

        await advance(3000)

        expect(screen.getByText('00:29:57')).toBeInTheDocument()
        expect(props.setActiveTimer).toHaveBeenCalledWith(true)
        expect(props.setWorkedTime).toHaveBeenCalledTimes(3)
    })

    it('moves the progress bar as time passes', async () => {
        const { store } = renderTimer()
        fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
        await advance(3000)
        const { timer, sessionParams } = store.getState().session
        expect(sessionParams.time - timer.time).toBe(3000)
    })

    describe('time per task', () => {
        it('books every running second on the active task', async () => {
            const { store } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))

            await advance(3000)

            expect(workedTasks(store)).toEqual([{ ...taskA, time: 3 }])
        })

        it('splits the time between tasks when another one is dropped in', async () => {
            const { store, switchTask } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await advance(2000)

            switchTask(taskB)
            await advance(3000)

            expect(workedTasks(store)).toEqual([{ ...taskA, time: 2 }, { ...taskB, time: 3 }])
        })

        it('switching tasks does not make the countdown drift', async () => {
            const { switchTask } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await act(async () => { vi.advanceTimersByTime(600) })

            switchTask(taskB) // mid-second
            await act(async () => { vi.advanceTimersByTime(400) })

            // still exactly one tick after one second in total
            expect(screen.getByText('00:29:59')).toBeInTheDocument()
        })

        it('books nothing while paused', async () => {
            const { store } = renderTimer(taskA)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
            await advance(1000)
            fireEvent.click(screen.getByRole('button', { name: 'pause timer' }))

            await advance(5000)

            expect(workedTasks(store)[0].time).toBe(1)
        })

        it('books nothing on any task when no task is in the work area', async () => {
            const { store } = renderTimer(null)
            fireEvent.click(screen.getByRole('button', { name: 'start timer' }))

            await advance(3000)

            expect(workedTasks(store)).toEqual([])
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
        const { props } = renderTimer()
        fireEvent.click(screen.getByRole('button', { name: 'start timer' }))
        await advance(1000)

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'stop timer' })) })

        expect(screen.getByText('00:00:00')).toBeInTheDocument()
        expect(props.setActiveTimer).toHaveBeenLastCalledWith(false)
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
