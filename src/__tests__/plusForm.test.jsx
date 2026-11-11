import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { setLanguage, showForms } from '../features/settings/settingsAction'
import { forgetAiQuota } from '../features/ai/ai'
import QuickAdd from '../components/QuickAdd'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

async function openPlus() {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('de'))
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester: false, adminPendingCount: 0, betaRequest: null } })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [], groups: [], notes: [] } })
    render(<Provider store={store}><MemoryRouter><QuickAdd /></MemoryRouter></Provider>)
    await act(async () => { store.dispatch(showForms(true)) })
    return store
}
const posted = (path) => apiFetch.mock.calls.filter(([url, o]) => url === path && o?.method === 'POST').map(([, o]) => JSON.parse(o.body))

describe('the plus button\'s form', () => {
    beforeEach(() => {
        forgetAiQuota()
        apiFetch.mockReset()
        apiFetch.mockImplementation(async (url, options = {}) => {
            if (url === '/api/notebook' && options.method === 'POST') return { id: 77, ...JSON.parse(options.body), attachments: [] }
            return []
        })
    })

    it('names the day and time fields above them', async () => {
        await openPlus()
        const form = screen.getByRole('dialog')
        expect(within(form).getByText('Fälligkeitsdatum', { selector: 'span' })).toBeInTheDocument()
        expect(within(form).getByText('Uhrzeit', { selector: 'span' })).toBeInTheDocument()
        fireEvent.click(within(form).getByRole('radio', { name: /^Event/ }))
        for (const label of ['Tag', 'Beginn', 'Ende']) expect(within(form).getByText(label, { selector: 'span' })).toBeInTheDocument()
    })

    it('keeps the priority under "Weitere Optionen"', async () => {
        await openPlus()
        expect(screen.queryByRole('slider')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: /Weitere Optionen/ }))
        expect(screen.getByRole('slider')).toBeInTheDocument()
    })

    it('makes a note: title and text, saved into the notebook', async () => {
        await openPlus()
        fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Ideen fürs Referat' } })
        fireEvent.click(screen.getByRole('radio', { name: /^Notiz/ }))
        expect(screen.getByRole('textbox', { name: 'Titel der Notiz' })).toHaveValue('Ideen fürs Referat')
        await screen.findByRole('textbox', { name: 'Text der Notiz' }, { timeout: 5000 })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' })) })
        expect(posted('/api/notebook')).toEqual([expect.objectContaining({ title: 'Ideen fürs Referat', body: '' })])
    })

    it('from the note back to a task keeps the title', async () => {
        await openPlus()
        fireEvent.click(screen.getByRole('radio', { name: /^Notiz/ }))
        fireEvent.change(screen.getByRole('textbox', { name: 'Titel der Notiz' }), { target: { value: 'Vokabeln' } })
        fireEvent.click(screen.getByRole('radio', { name: /^Aufgabe/ }))
        expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Vokabeln')
    })
})
