import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { showForms } from '../features/settings/settingsAction'
import { startFocus } from '../features/session/sessionAction'
import App from '../App'

// Without an account everything that would save something asks for one instead
async function renderApp(path = '/') {
    window.history.replaceState(null, '', path)
    const store = configureStore({ reducer: rootReducer })
    await act(async () => {
        render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></Provider>)
    })
    return store
}

beforeEach(() => {
    localStorage.clear()
    globalThis.fetch = vi.fn()
})

const signInWindow = () => screen.queryByRole('dialog', { name: 'Melde dich an, um loszulegen' })

describe('what needs an account asks for one', () => {
    it('the new-task form opens the sign-in window instead', async () => {
        const store = await renderApp('/')
        await act(async () => { store.dispatch(showForms(true)) })
        expect(signInWindow()).toBeInTheDocument()
        expect(store.getState().settings.showForms).toBe(false)
    })

    it('N does too', async () => {
        await renderApp('/')
        await act(async () => { fireEvent.keyDown(document.body, { key: 'n' }) })
        expect(signInWindow()).toBeInTheDocument()
    })

    it('the round add button does too', async () => {
        await renderApp('/')
        await act(async () => { screen.getByRole('button', { name: 'Neue Aufgabe oder neues Event' }).click() })
        expect(signInWindow()).toBeInTheDocument()
    })

    it('starting the timer does too, and it stays off', async () => {
        const store = await renderApp('/')
        await act(async () => { store.dispatch(startFocus()) })
        expect(signInWindow()).toBeInTheDocument()
        expect(store.getState().session.timer.active).toBe(false)
    })

    it('the Fokusraum asks when the goal field is used', async () => {
        await renderApp('/focus')
        const field = await screen.findByPlaceholderText('Zum Beispiel: Kapitel 4 zusammenfassen')
        await act(async () => { field.focus() })
        expect(signInWindow()).toBeInTheDocument()
    })
})
