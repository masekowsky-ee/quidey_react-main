import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import TaskNoteRow from '../components/task/TaskNoteRow'
import { refreshTaskNotes } from '../features/tasks/taskAction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const renderRow = (note) => render(
    <Provider store={configureStore({ reducer: rootReducer })}>
        <MemoryRouter><ul><TaskNoteRow taskId={7} note={note} /></ul></MemoryRouter>
    </Provider>
)

// A task's notes are notebook notes about it (backend migration 043)
describe('notes on a task', () => {
    beforeEach(() => {
        apiFetch.mockReset()
        apiFetch.mockImplementation((url, options) => Promise.resolve(options?.body ? { id: 1, task_id: 7, ...JSON.parse(options.body) } : {}))
    })

    it('a one-line note is edited in place, and only a real change is saved', () => {
        renderRow({ id: 1, task_id: 7, content: 'Folien' })
        const input = screen.getByRole('textbox')
        fireEvent.blur(input)
        expect(apiFetch).not.toHaveBeenCalled()
        fireEvent.change(input, { target: { value: 'Folien bis Freitag ' } })
        fireEvent.blur(input)
        expect(apiFetch).toHaveBeenCalledWith('/api/notes/1', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ taskId: 7, content: 'Folien bis Freitag' }) }))
    })

    it('a note with more lines is never flattened: it shows its first line and opens the notebook', () => {
        renderRow({ id: 2, task_id: 7, content: 'Gliederung\n- [ ] Zelle\n- [ ] Kern' })
        expect(screen.queryByRole('textbox')).toBeNull()
        const link = screen.getByRole('link', { name: /Gliederung/ })
        expect(link).toHaveAttribute('href', '/focus')
        expect(screen.queryByRole('button')).toBeNull()
    })

    it('notes written in the notebook come into the list when it is loaded again', async () => {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [], groups: [], notes: [] } })
        apiFetch.mockResolvedValueOnce([{ id: 3, task_id: 7, content: 'aus dem Notizbuch' }])
        await act(() => store.dispatch(refreshTaskNotes()))
        expect(apiFetch).toHaveBeenCalledWith('/api/notes')
        expect(store.getState().task.notes).toEqual([{ id: 3, task_id: 7, content: 'aus dem Notizbuch' }])
    })
})
