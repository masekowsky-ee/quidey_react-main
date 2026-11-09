import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { setFocusTask } from '../features/session/sessionAction'
import FocusRoom from '../components/focus/FocusRoom.jsx'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const essay = { id: 7, name: 'Essay', done: false, due: null, prio: 1, description: null, group_ids: [] }
let notes

function mockApi() {
    notes = []
    apiFetch.mockImplementation(async (url, options = {}) => {
        const body = options.body ? JSON.parse(options.body) : undefined
        if (url === '/api/notebook' && !options.method) return structuredClone(notes)
        if (url === '/api/notebook' && options.method === 'POST') {
            const note = { id: 40 + notes.length, title: body.title ?? '', body: body.body ?? '', taskId: body.taskId ?? null, pinned: false,
                archived: false, attachments: [], updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() }
            notes.unshift(note)
            return structuredClone(note)
        }
        if (url.startsWith('/api/notebook/') && options.method === 'PUT') {
            const note = notes.find(n => n.id === Number(url.split('/').pop()))
            Object.assign(note, body)
            return structuredClone(note)
        }
        return {}
    })
}

async function renderRoom() {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [essay], groups: [], notes: [] } })
    await act(async () => {
        render(<Provider store={store}><MemoryRouter><FocusRoom /></MemoryRouter></Provider>)
    })
    return store
}

beforeEach(() => {
    localStorage.clear()
    apiFetch.mockReset()
    mockApi()
})

describe('Fokusraum: goal, timer, notes', () => {
    it('shows the three steps; everything else waits behind the focus settings', async () => {
        await renderRoom()
        expect(screen.getByRole('textbox', { name: 'Was willst du schaffen?' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'start timer' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'In dieser Sitzung notieren' })).toBeInTheDocument()
        for (const hidden of ['Gedankenparkplatz', 'Fokus-Geräusche', 'Lernmethode']) {
            expect(screen.queryByText(hidden)).not.toBeInTheDocument()
        }

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Fokus-Einstellungen' })) })
        const sheet = screen.getByRole('dialog', { name: 'Fokus-Einstellungen' })
        for (const shown of ['Gedankenparkplatz', 'Fokus-Geräusche', 'Lernmethode', 'Pomodoro-Längen']) {
            expect(within(sheet).getByText(shown)).toBeInTheDocument()
        }
    })

    it('the task chip picks the task in focus', async () => {
        const store = await renderRoom()
        fireEvent.change(screen.getByRole('combobox', { name: 'Aufgabe' }), { target: { value: '7' } })
        expect(store.getState().session.focusTask).toMatchObject({ id: 7, name: 'Essay' })
    })

    it('writing in the waiting notes makes a note named after the goal, about the task in focus', async () => {
        const store = await renderRoom()
        await act(async () => { store.dispatch(setFocusTask(essay)) })
        fireEvent.change(screen.getByRole('textbox', { name: 'Was willst du schaffen?' }), { target: { value: 'Kapitel 4 zusammenfassen' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'In dieser Sitzung notieren' })) })

        const posted = apiFetch.mock.calls.find(([url, o]) => url === '/api/notebook' && o?.method === 'POST')
        expect(JSON.parse(posted[1].body)).toMatchObject({ title: 'Kapitel 4 zusammenfassen', taskId: 7 })
        // the editor is open, ready to type into
        const text = await screen.findByRole('textbox', { name: 'Text der Notiz' })
        await waitFor(() => expect(document.activeElement).toBe(text))
    })

    it('the same goal on the same day opens the same note again', async () => {
        await renderRoom()
        fireEvent.change(screen.getByRole('textbox', { name: 'Was willst du schaffen?' }), { target: { value: 'Vokabeln' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'In dieser Sitzung notieren' })) })
        const posts = () => apiFetch.mock.calls.filter(([url, o]) => url === '/api/notebook' && o?.method === 'POST').length
        expect(posts()).toBe(1)

        document.body.innerHTML = ''
        await renderRoom()
        expect(screen.queryByRole('button', { name: 'In dieser Sitzung notieren' })).not.toBeInTheDocument()
        expect(posts()).toBe(1)
    })
})
