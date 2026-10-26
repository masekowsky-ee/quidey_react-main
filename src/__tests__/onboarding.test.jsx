import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { apiFetch } from '../features/helperFunction'
import { installState } from '../features/pwa/install'
import { addTask, addGroup, updateTaskProps } from '../features/tasks/taskAction'
import {
    startOnboarding, noteAction, askNextSteps, resetOnboarding, setOnboardingAccount, useOnboarding,
    INSTALL_AFTER, RATING_AFTER, RATING_DELAY_MS,
} from '../features/onboarding/onboarding'
import OnboardingPrompts from '../components/onboarding/OnboardingPrompts'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

vi.mock('../features/pwa/install', async (importOriginal) => ({
    ...(await importOriginal()),
    installState: vi.fn(() => 'prompt'),
}))

// the open question ('none' while there is none)
const Probe = () => <output data-testid="asking">{useOnboarding().asking ?? 'none'}</output>
const asked = () => screen.getByTestId('asking').textContent

const makeStore = () => {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 't', username: 'ann' } })
    return store
}

// shows where the app is, for the questions that lead somewhere
const Where = () => {
    const location = useLocation()
    return <p data-testid="where">{location.pathname + location.hash + location.search}</p>
}

const renderPrompts = (store = makeStore()) => {
    render(
        <Provider store={store}>
            <MemoryRouter>
                <OnboardingPrompts />
                <Probe />
                <Routes><Route path="*" element={<Where />} /></Routes>
            </MemoryRouter>
        </Provider>
    )
    return store
}

const times = (n, kind) => { for (let i = 0; i < n; i++) noteAction(kind) }

beforeEach(() => {
    localStorage.clear()
    resetOnboarding()
    apiFetch.mockReset()
    installState.mockReturnValue('prompt')
})

afterEach(() => vi.useRealTimers())

describe('onboarding: when it asks', () => {
    it('only for a new account (whose tour opened by itself)', () => {
        renderPrompts()
        act(() => { setOnboardingAccount('ann'); times(20, 'done') })
        expect(asked()).toBe('none')
        act(() => askNextSteps())
        expect(asked()).toBe('none')
        expect(localStorage.getItem('onboarding:ann')).toBeNull()
    })

    it('asks to install from the third action, once, and only where it can be installed', () => {
        renderPrompts()
        installState.mockReturnValue('unavailable')
        act(() => { startOnboarding('ann'); times(INSTALL_AFTER, 'task') })
        expect(asked()).toBe('none')

        // already installed: no question either
        installState.mockReturnValue('installed')
        act(() => noteAction('group'))
        expect(asked()).toBe('none')

        installState.mockReturnValue('ios')
        act(() => noteAction('group'))
        expect(asked()).toBe('install')
        act(() => fireEvent.click(screen.getByRole('button', { name: 'Nein, danke' })))
        expect(asked()).toBe('none')
        act(() => times(5, 'task'))
        expect(asked()).toBe('none')
    })

    it('asks whether they like it at the first success after ten actions, a moment later', () => {
        vi.useFakeTimers()
        installState.mockReturnValue('installed')
        renderPrompts()
        act(() => { startOnboarding('ann'); times(RATING_AFTER, 'task') })
        // the eleventh, but no success
        act(() => noteAction('group'))
        act(() => vi.advanceTimersByTime(RATING_DELAY_MS))
        expect(asked()).toBe('none')

        act(() => noteAction('done'))
        expect(asked()).toBe('none')
        act(() => vi.advanceTimersByTime(RATING_DELAY_MS))
        expect(asked()).toBe('rating')
        expect(screen.getByRole('heading', { name: 'Gefällt dir Quidey?' })).toBeInTheDocument()

        // only once
        act(() => fireEvent.keyDown(window, { key: 'Escape' }))
        act(() => { noteAction('done'); vi.advanceTimersByTime(RATING_DELAY_MS) })
        expect(asked()).toBe('none')
    })

    it('counts what the actions of the app do', async () => {
        const store = renderPrompts()
        act(() => startOnboarding('ann'))
        apiFetch.mockImplementation(async (url, options) => {
            if (url === '/api/groups') return { id: 7, name: 'Mathe' }
            if (options?.method === 'PUT') return { ...JSON.parse(options.body), id: 1 }
            return { id: 1, name: 'Essay', done: false }
        })
        await act(() => store.dispatch(addTask('Essay')))
        await act(() => store.dispatch(addGroup('Mathe')))
        expect(asked()).toBe('none')
        await act(() => store.dispatch(updateTaskProps({ done: true }, { id: 1, name: 'Essay', done: false })))
        expect(JSON.parse(localStorage.getItem('onboarding:ann')).actions).toBe(3)
        expect(asked()).toBe('install')
    })

    it('another account has its own questions', () => {
        renderPrompts()
        act(() => { startOnboarding('ann'); setOnboardingAccount('bob'); times(5, 'task') })
        expect(asked()).toBe('none')
    })
})

describe('onboarding: the questions', () => {
    it('after the tour: what first, each leads somewhere, or just look around', () => {
        const store = renderPrompts()
        act(() => { startOnboarding('ann'); askNextSteps() })
        expect(screen.getByRole('heading', { name: 'Was möchtest du als Erstes machen?' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Freunde hinzufügen/ })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Erste Aufgabe anlegen/ }))
        expect(store.getState().settings.showForms).toBe(true)
        expect(asked()).toBe('none')

        act(() => askNextSteps())
        fireEvent.click(screen.getByRole('button', { name: /Freunde hinzufügen/ }))
        expect(screen.getByTestId('where')).toHaveTextContent('/community/friends?tab=add')

        act(() => askNextSteps())
        fireEvent.click(screen.getByRole('button', { name: 'Erst mal umsehen' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('install: yes opens the settings where it is installed', () => {
        renderPrompts()
        act(() => { startOnboarding('ann'); times(INSTALL_AFTER, 'task') })
        fireEvent.click(screen.getByRole('button', { name: /Ja, zeig mir wie/ }))
        expect(screen.getByTestId('where')).toHaveTextContent('/settings#app')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    const askRating = () => {
        vi.useFakeTimers()
        installState.mockReturnValue('installed')
        renderPrompts()
        act(() => { startOnboarding('ann'); times(RATING_AFTER, 'task'); noteAction('done'); vi.advanceTimersByTime(RATING_DELAY_MS) })
        vi.useRealTimers()
    }

    it('likes it: stars (and a word if they want), sent as a rating', async () => {
        askRating()
        apiFetch.mockResolvedValue({ sent: true })
        fireEvent.click(screen.getByRole('button', { name: /Ja!/ }))
        const send = screen.getByRole('button', { name: /Senden/ })
        expect(send).toBeDisabled()
        fireEvent.click(screen.getByRole('radio', { name: '4 Sterne' }))
        expect(screen.getByRole('radio', { name: '4 Sterne' })).toHaveAttribute('aria-checked', 'true')
        fireEvent.click(send)
        expect(await screen.findByRole('heading', { name: 'Danke dir!' })).toBeInTheDocument()
        expect(apiFetch).toHaveBeenCalledWith('/api/feedback', expect.objectContaining({ method: 'POST' }))
        expect(JSON.parse(apiFetch.mock.calls.at(-1)[1].body)).toEqual({ category: 'rating', liked: true, stars: 4, message: '' })
        fireEvent.click(screen.getByRole('button', { name: "Weiter geht's" }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('not really: what could be better, needs a few words', async () => {
        askRating()
        apiFetch.mockResolvedValue({ sent: true })
        fireEvent.click(screen.getByRole('button', { name: 'Nicht wirklich' }))
        expect(screen.getByRole('heading', { name: 'Schade! Was können wir besser machen?' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Senden/ }))
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(apiFetch).not.toHaveBeenCalled()

        fireEvent.change(screen.getByLabelText('Deine Nachricht'), { target: { value: 'Zu viele Knöpfe.' } })
        fireEvent.click(screen.getByRole('button', { name: /Senden/ }))
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Danke dir!' })).toBeInTheDocument())
        expect(JSON.parse(apiFetch.mock.calls.at(-1)[1].body)).toEqual({ category: 'rating', liked: false, message: 'Zu viele Knöpfe.' })
    })
})
