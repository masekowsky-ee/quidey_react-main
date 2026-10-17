import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { createRef } from 'react'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import WorkingContainer from '../components/WorkingContainer'
import { addTaskTime } from '../features/session/sessionAction'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const task = (id, extra = {}) => ({ id, name: `task ${id}`, due: '2026-10-19T22:00:00.000Z', description: '', prio: 50, done: false, ...extra })

function renderCard(activeTask) {
    const store = configureStore({ reducer: rootReducer })
    const setActiveTask = vi.fn()
    const ui = (t) => (
        <Provider store={store}>
            <WorkingContainer dropZoneRef={createRef()} activeTask={t} setActiveTask={setActiveTask} />
        </Provider>
    )
    const view = render(ui(activeTask))
    return { store, setActiveTask, rerender: (t) => view.rerender(ui(t)) }
}

// German is the default language
const descriptionInput = () => screen.getByPlaceholderText('Beschreibung')
const puts = () => apiFetch.mock.calls.filter(([, options]) => options?.method === 'PUT')

describe('WorkingContainer', () => {
    beforeEach(() => {
        apiFetch.mockReset()
        apiFetch.mockImplementation((url, options) => Promise.resolve(options?.body ? JSON.parse(options.body) : {}))
    })

    it('shows a hint when no task is dropped', () => {
        renderCard(null)
        expect(screen.getByText('Ziehe eine Aufgabe hierher')).toBeInTheDocument()
    })

    it('clicking into an empty description and out again sends nothing', () => {
        renderCard(task(1))
        fireEvent.focus(descriptionInput())
        fireEvent.blur(descriptionInput())
        expect(puts()).toHaveLength(0)
    })

    it('saves a new description once, trimmed, when Enter is pressed', async () => {
        const { setActiveTask } = renderCard(task(1))
        const input = descriptionInput()
        input.focus()
        fireEvent.change(input, { target: { value: '  write the summary  ' } })

        await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })

        expect(puts()).toHaveLength(1) // Enter blurs; blur is the only place that saves
        expect(JSON.parse(puts()[0][1].body).description).toBe('write the summary')
        expect(setActiveTask).toHaveBeenCalledTimes(1)
    })

    it('does not save when the existing description is left unchanged', () => {
        renderCard(task(1, { description: 'keep me' }))
        fireEvent.click(screen.getByText('keep me'))
        fireEvent.blur(descriptionInput())
        expect(puts()).toHaveLength(0)
    })

    it('starts with an empty input for the next task instead of carrying text over', () => {
        const { rerender } = renderCard(task(1))
        fireEvent.change(descriptionInput(), { target: { value: 'typed for task 1' } })

        rerender(task(2))

        expect(descriptionInput()).toHaveValue('')
    })

    it('shows the time spent on the active task in this session, live', async () => {
        const { store } = renderCard(task(1))
        expect(screen.getByText('00:00:00')).toBeInTheDocument()

        await act(async () => { store.dispatch(addTaskTime(task(1), 75)) })

        expect(screen.getByText('00:01:15')).toBeInTheDocument()
    })

    it('the checkmark marks the task done and clears the drop zone', async () => {
        const { setActiveTask } = renderCard(task(1))

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Als erledigt markieren' })) })

        expect(JSON.parse(puts()[0][1].body)).toMatchObject({ id: 1, done: true })
        expect(setActiveTask).toHaveBeenCalledWith(null)
    })
})
