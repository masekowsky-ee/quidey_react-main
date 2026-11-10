import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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
import SessionNotes from '../components/focus/SessionNotes'
import NotesPage from '../components/notes/NotesPage'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

let available
function mount(ui) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('de'))
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester: true, adminPendingCount: 0, betaRequest: null } })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [], groups: [], notes: [] } })
    render(<Provider store={store}><MemoryRouter>{ui}</MemoryRouter></Provider>)
    return store
}
const scanSheet = () => screen.queryByRole('dialog', { name: 'Scannen' })

describe('scanning from more places', () => {
    beforeEach(() => {
        forgetAiQuota()
        available = true
        apiFetch.mockReset()
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/ai/quota') return { available, scan: { used: 0, max: 1 }, aiLine: { used: 0, max: 5 }, resetsAt: null }
            if (url.startsWith('/api/notebook')) return []
            return []
        })
    })

    it('the plus button: "Material scannen" swaps the form for the scan sheet', async () => {
        const store = mount(<QuickAdd />)
        await act(async () => { store.dispatch(showForms(true)) })
        await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Material scannen' })) })
        expect(scanSheet()).toBeInTheDocument()
        expect(store.getState().settings.showForms).toBe('scan')
    })

    it('the session\'s notes have a scan button', async () => {
        await act(async () => { mount(<SessionNotes goal="Kapitel 4" focusTask={null} />) })
        await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Scannen' })) })
        expect(scanSheet()).toBeInTheDocument()
    })

    it('the notes page has a scan button', async () => {
        await act(async () => { mount(<NotesPage />) })
        await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Scannen' })) })
        expect(scanSheet()).toBeInTheDocument()
    })

    it('none of them where the AI isn\'t set up', async () => {
        available = false
        const store = mount(<><QuickAdd /><SessionNotes goal="" focusTask={null} /></>)
        await act(async () => { store.dispatch(showForms(true)) })
        await act(async () => {})
        expect(screen.queryByRole('button', { name: 'Material scannen' })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Scannen' })).toBeNull()
    })
})
