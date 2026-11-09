import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { setLanguage } from '../features/settings/settingsAction'
import { notePreview } from '../features/notes/notes'
import { clampPlacement, cropSquare } from '../features/profile/avatars'
import { pinnableBoards } from '../features/board/board'
import NoteBoard from '../components/board/NoteBoard'
import NotePreview from '../components/notes/NotePreview'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

function makeStore() {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch(setLanguage('en'))
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'lena' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester: false, userId: 1 } })
    return store
}
const wrap = (ui, store = makeStore()) => render(<Provider store={store}><MemoryRouter>{ui}</MemoryRouter></Provider>)

function serve(routes) {
    apiFetch.mockImplementation(async (url, options = {}) => {
        const key = `${options.method ?? 'GET'} ${url}`
        const found = routes[key]
        if (found === undefined) return {}
        return typeof found === 'function' ? found(options) : found
    })
}
const sent = (method, url) => apiFetch.mock.calls.filter(([u, o = {}]) => u === url && (o.method ?? 'GET') === method)

const LENA = { id: 1, username: 'lena', displayName: 'Lena' }
const MO = { id: 2, username: 'mo', displayName: 'Mo' }
const pin = (overrides) => ({
    id: 10, noteId: 100, title: 'Formulas', body: '# Analysis\n- [ ] **derive** it', color: null, attachments: [],
    updatedAt: '2026-11-04T10:00:00Z', pinnedAt: '2026-11-04T10:00:00Z', owner: MO, mine: false, canRemove: false, ...overrides,
})

describe('a note always shows a preview', () => {
    it('the lines as they read, after the one standing in as title', () => {
        expect(notePreview({ title: 'Plan', body: '# Week\n- [ ] **read** `ch. 2`' })).toEqual({ text: 'Week read ch. 2' })
        expect(notePreview({ title: '', body: 'First\nSecond' })).toEqual({ text: 'Second' })
        expect(notePreview({ title: 'Only title', body: '', attachments: [{ kind: 'link' }, { kind: 'image' }] })).toEqual({ attachments: 2 })
        expect(notePreview({ title: 'Empty', body: '  \n---' })).toEqual({ empty: true })
        expect(notePreview({ title: 'x', body: 'a'.repeat(400) }, 50).text).toHaveLength(50)
    })

    it('without text it says so instead of leaving the line out', () => {
        wrap(<NotePreview note={{ title: 'Empty', body: '', attachments: [] }} />)
        expect(screen.getByText('Nothing written yet')).toHaveAttribute('data-empty')
    })
})

describe('profile picture in a circle', () => {
    const image = { width: 400, height: 200 }

    it('the circle is always covered: zoom from 1, the picture moves only as far as it reaches', () => {
        expect(clampPlacement(image, { zoom: 0.5, x: 0, y: 0 })).toEqual({ zoom: 1, x: 0, y: 0 })
        // 400 × 200 at zoom 1: two circle widths wide, one high
        expect(clampPlacement(image, { zoom: 1, x: 3, y: 1 })).toEqual({ zoom: 1, x: 0.5, y: 0 })
        expect(clampPlacement(image, { zoom: 9, x: 0, y: 0 }).zoom).toBe(4)
    })

    it('the square cut out of the picture is the one under the circle', () => {
        expect(cropSquare(image, { zoom: 1, x: 0, y: 0 })).toEqual({ sx: 100, sy: 0, side: 200 })
        // moved right as far as it goes: the left end of the picture is in the circle
        expect(cropSquare(image, { zoom: 1, x: 0.5, y: 0 })).toEqual({ sx: 0, sy: 0, side: 200 })
        expect(cropSquare(image, { zoom: 2, x: 0, y: 0 })).toEqual({ sx: 150, sy: 50, side: 100 })
    })
})

describe('notes on a board', () => {
    beforeEach(() => apiFetch.mockReset())

    it('only my families and open sessions can be pinned to', () => {
        expect(pinnableBoards([{ id: 3, name: 'Home', emoji: '🏡' }], [{ id: 7, name: 'Maths' }, { id: 8, name: 'Old', endedAt: '2026-11-01' }]))
            .toEqual([{ kind: 'family', id: 3, name: 'Home', emoji: '🏡' }, { kind: 'session', id: 7, name: 'Maths', emoji: null }])
    })

    it('shows the pinned notes with a preview, opens one to read, its checklist only to look at', async () => {
        serve({
            'GET /api/families/3/board': [pin()],
            'GET /api/families/3/board/10': pin({ attachments: [] }),
        })
        await act(async () => { wrap(<NoteBoard kind="family" id={3} />) })
        const card = await screen.findByRole('button', { name: /Formulas/ })
        expect(within(card).getByText('Analysis derive it')).toBeInTheDocument()
        expect(within(card).getByText('Mo')).toBeInTheDocument()

        await act(async () => { fireEvent.click(card) })
        const dialog = await screen.findByRole('dialog', { name: 'Formulas' })
        expect(within(dialog).getByRole('checkbox')).toBeDisabled()
        expect(within(dialog).queryByRole('button', { name: /Take off the board/ })).toBeNull()
        expect(sent('GET', '/api/families/3/board/10')).toHaveLength(1)
    })

    it('pins one of my notes; the ones already here are marked', async () => {
        serve({
            'GET /api/shared-sessions/7/board': [pin({ id: 11, noteId: 200, title: 'Mine', owner: LENA, mine: true, canRemove: true })],
            'GET /api/notebook': [
                { id: 200, title: 'Mine', body: 'x', attachments: [], pinned: false, archived: false, updatedAt: '2026-11-04T09:00:00Z', createdAt: '2026-11-04T09:00:00Z' },
                { id: 201, title: 'Reading list', body: 'Book one\nBook two', attachments: [], pinned: false, archived: false, updatedAt: '2026-11-04T08:00:00Z', createdAt: '2026-11-04T08:00:00Z' },
            ],
            'POST /api/shared-sessions/7/board': pin({ id: 12, noteId: 201, title: 'Reading list', body: 'Book one\nBook two', owner: LENA, mine: true, canRemove: true }),
        })
        await act(async () => { wrap(<NoteBoard kind="session" id={7} />) })
        await act(async () => { fireEvent.click(await screen.findByRole('button', { name: /Pin a note/ })) })
        const dialog = await screen.findByRole('dialog', { name: 'Pin a note' })
        expect(await within(dialog).findByRole('button', { name: /Mine/ })).toBeDisabled()
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: /Reading list/ })) })

        await waitFor(() => expect(sent('POST', '/api/shared-sessions/7/board')).toHaveLength(1))
        expect(JSON.parse(sent('POST', '/api/shared-sessions/7/board')[0][1].body)).toEqual({ noteId: 201 })
        expect(await screen.findByRole('button', { name: /Reading list/ })).toBeInTheDocument()
    })

    it('an ended session shows its board without a way to pin', async () => {
        serve({ 'GET /api/shared-sessions/8/board': [] })
        await act(async () => { wrap(<NoteBoard kind="session" id={8} canPin={false} />) })
        expect(await screen.findByText('No notes were pinned here.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Pin a note/ })).toBeNull()
    })
})
