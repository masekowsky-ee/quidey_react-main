import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import NoteEditor from '../components/notes/NoteEditor'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const note = { id: 5, title: 'Kapitel 4', body: '# Kapitel 4\n- [ ] lesen', attachments: [], pinned: false, taskId: null }
const puts = () => apiFetch.mock.calls.filter(([url, o]) => url === '/api/notebook/5' && o?.method === 'PUT').map(([, o]) => JSON.parse(o.body))

const open = async () => {
    const onChange = vi.fn()
    const view = render(
        <Provider store={configureStore({ reducer: rootReducer })}>
            <MemoryRouter><NoteEditor note={note} onChange={onChange} onDelete={() => {}} onClose={() => {}} /></MemoryRouter>
        </Provider>
    )
    const box = await screen.findByRole('textbox', { name: 'Text der Notiz' })
    return { ...view, editor: box.editor }
}

// The notes' editor saves the same lines as before, a moment after the last change
describe('saving a note from the editor', () => {
    beforeEach(() => {
        apiFetch.mockReset()
        apiFetch.mockImplementation((url, options) => Promise.resolve(options?.body ? { ...note, ...JSON.parse(options.body) } : note))
    })

    it('opening a note sends nothing', async () => {
        await open()
        await new Promise(resolve => setTimeout(resolve, 900))
        expect(puts()).toEqual([])
    })

    it('saves what was written as the stored lines', async () => {
        const { editor } = await open()
        act(() => { editor.commands.setTextSelection(editor.state.doc.content.size - 2); editor.commands.insertContent(' und markieren') })
        await waitFor(() => expect(puts()).toEqual([{ title: 'Kapitel 4', body: '# Kapitel 4\n- [ ] lesen und markieren' }]), { timeout: 2000 })
    })

    it('saves what is still waiting when the note is closed', async () => {
        const { editor, unmount } = await open()
        act(() => { editor.commands.setTextSelection(3); editor.commands.insertContent('!') })
        unmount()
        expect(puts()).toEqual([{ title: 'Kapitel 4', body: '# Ka!pitel 4\n- [ ] lesen' }])
    })

    it('keeps a text over the limit from being sent and says so', async () => {
        const { editor } = await open()
        act(() => { editor.commands.insertContent('x'.repeat(20001)) })
        expect(await screen.findByText('Zu lang zum Speichern (höchstens 20.000 Zeichen)', {}, { timeout: 2000 })).toBeInTheDocument()
        expect(puts()).toEqual([])
    })
})
