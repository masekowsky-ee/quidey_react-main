import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { setLanguage } from '../features/settings/settingsAction'
import { fetchNote, updateNote } from '../features/focus/notebook'
import { pinCardNote, clearCardNote } from '../features/home/cardNote'
import FocusSheet from '../components/home/FocusSheet'

vi.mock('../features/focus/notebook', async (importOriginal) => ({
    ...(await importOriginal()),
    fetchNote: vi.fn(),
    updateNote: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(() => Promise.resolve([])),
}))

const note = { id: 5, title: 'Einkauf', body: '# Liste\n- [ ] Milch\n- [x] Brot', trashedAt: null }

function renderCard() {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('de'))
    render(<Provider store={store}><MemoryRouter><FocusSheet dropZoneRef={{ current: null }} activeTask={null} setActiveTask={() => {}} onRelease={() => {}} /></MemoryRouter></Provider>)
    return store
}

describe('a note in Home\'s card', () => {
    beforeEach(() => {
        clearCardNote()
        fetchNote.mockReset()
        updateNote.mockClear()
        fetchNote.mockResolvedValue(note)
    })

    it('shows the note with its list, and no timer or focus link', async () => {
        renderCard()
        expect(screen.getByRole('button', { name: /Start/ })).toBeInTheDocument()
        await act(async () => { pinCardNote(5) })
        expect(await screen.findByRole('heading', { name: 'Einkauf' })).toBeInTheDocument()
        expect(screen.getByText('Milch')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Start/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('timer')).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Im Fokusraum öffnen' })).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Notiz öffnen' })).toHaveAttribute('href', '/notes?note=5')
    })

    it('a tick on the list is saved in the note', async () => {
        renderCard()
        await act(async () => { pinCardNote(5) })
        fireEvent.click(await screen.findByRole('checkbox', { name: /Milch/ }))
        expect(updateNote).toHaveBeenCalledWith(5, { body: '# Liste\n- [x] Milch\n- [x] Brot' })
    })

    it('"Aus Karte nehmen" brings the timer back', async () => {
        renderCard()
        await act(async () => { pinCardNote(5) })
        fireEvent.click(await screen.findByRole('button', { name: 'Aus Karte nehmen' }))
        expect(await screen.findByRole('button', { name: /Start/ })).toBeInTheDocument()
    })

    it('a note that is gone leaves the card', async () => {
        fetchNote.mockRejectedValue(new Error('gone'))
        renderCard()
        await act(async () => { pinCardNote(9) })
        expect(await screen.findByRole('button', { name: /Start/ })).toBeInTheDocument()
    })
})
