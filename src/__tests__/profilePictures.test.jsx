import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS } from '../features/auth/authActionTypes'
import { forgetAvatar } from '../features/profile/avatars'
import ProfileAvatar from '../components/profile/ProfileAvatar'
import AdminTesterFeedback from '../components/tester/AdminTesterFeedback'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

function makeStore({ isTester = false, isAdmin = false } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isTester, isAdmin, userId: 1 } })
    return store
}
const wrap = (ui, store) => render(<Provider store={store}><MemoryRouter>{ui}</MemoryRouter></Provider>)
const ANN = { id: 5, username: 'ann', displayName: 'Ann Lee' }

describe('profile pictures (in test)', () => {
    beforeEach(() => {
        apiFetch.mockReset()
        forgetAvatar(5)
        globalThis.fetch = vi.fn().mockResolvedValue(new Response(new Blob(['x'], { type: 'image/webp' })))
        URL.createObjectURL = vi.fn(() => 'blob:ann')
        URL.revokeObjectURL = vi.fn()
    })
    afterEach(() => vi.useRealTimers())

    it('a tester sees the picture instead of the initials, loaded with its version', async () => {
        apiFetch.mockResolvedValue({ 5: '2026-10-28T10:00:00Z' })
        const { container } = wrap(<ProfileAvatar user={ANN} />, makeStore({ isTester: true }))
        expect(container.textContent).toBe('AL')
        await act(async () => { await new Promise(r => setTimeout(r, 60)) })

        expect(apiFetch).toHaveBeenCalledWith('/api/avatars?ids=5')
        expect(globalThis.fetch.mock.calls[0][0]).toBe('/api/avatars/5?v=2026-10-28T10%3A00%3A00Z')
        expect(container.querySelector('img')).toHaveAttribute('src', 'blob:ann')
        expect(container.textContent).toBe('')
    })

    it('everybody else keeps the initials and asks for nothing', async () => {
        const { container } = wrap(<ProfileAvatar user={ANN} />, makeStore())
        await act(async () => { await new Promise(r => setTimeout(r, 60)) })
        expect(apiFetch).not.toHaveBeenCalled()
        expect(container.querySelector('img')).toBeNull()
        expect(container.textContent).toBe('AL')
    })

    it('somebody without a picture stays as they were', async () => {
        apiFetch.mockResolvedValue({})
        const { container } = wrap(<ProfileAvatar user={ANN} />, makeStore({ isTester: true }))
        await act(async () => { await new Promise(r => setTimeout(r, 60)) })
        expect(globalThis.fetch).not.toHaveBeenCalled()
        expect(container.textContent).toBe('AL')
    })
})

describe('admin: what is in test right now', () => {
    it('lists the tester-only features apart from those out for everybody, with their ratings', async () => {
        apiFetch.mockImplementation(async (url) => url === '/api/admin/tester-feedback'
            ? { testers: 2, topics: [{ topic: 'feature:avatars', ratings: 2, average: 4.5, spread: [0, 0, 0, 1, 1], entries: [] }] }
            : {})
        await act(async () => { wrap(<AdminTesterFeedback />, makeStore({ isAdmin: true })) })

        const live = screen.getByRole('region', { name: 'Gerade im Test' })
        const lists = within(live).getAllByRole('list')
        expect(within(lists[0]).getByText('Profilbilder')).toBeInTheDocument()
        expect(within(lists[0]).getByText(/4,5 · 2 Bewertungen/)).toBeInTheDocument()
        expect(within(lists[0]).getByText('Oberflächen-Varianten')).toBeInTheDocument()
        expect(within(lists[1]).getByText('Untergruppen')).toBeInTheDocument()
        expect(within(lists[1]).queryByText('Profilbilder')).toBeNull()
    })
})
