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

function renderTimer() {
    const store = configureStore({ reducer: rootReducer })
    const props = { setActiveTimer: vi.fn(), setWorkedTime: vi.fn(), activeTask: null }
    render(<Provider store={store}><TimerContainer {...props} /></Provider>)
    return { store, props }
}

// Let the fake clock run, flushing React updates in between
const advance = async (ms) => {
    for (let i = 0; i < ms / 1000; i++) {
        await act(async () => { vi.advanceTimersByTime(1000) })
    }
}

describe('TimerContainer', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

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
