import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { useState } from 'react'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS } from '../features/auth/authActionTypes'
import { addSavedColor, removeSavedColor, selectSavedColors, SAVED_COLORS_MAX } from '../features/tasks/savedColors'
import TaskColorPicker from '../components/task/TaskColorPicker'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const makeStore = (savedColors = []) => {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, savedColors } })
    return store
}
const putBody = () => JSON.parse(apiFetch.mock.calls.filter(([url]) => url === '/api/users/colors').at(-1)[1].body)

beforeEach(() => {
    apiFetch.mockReset()
    apiFetch.mockImplementation(async (url, options) => ({ savedColors: JSON.parse(options.body).colors }))
})
afterEach(cleanup)

describe('my own colours', () => {
    it('come from /api/me; a new one goes first, a known one moves first, the oldest goes past the limit', async () => {
        const store = makeStore(['#111111', '#222222'])
        expect(selectSavedColors(store.getState())).toEqual(['#111111', '#222222'])
        await store.dispatch(addSavedColor('#AABBCC'))
        expect(putBody()).toEqual({ colors: ['#aabbcc', '#111111', '#222222'] })
        await store.dispatch(addSavedColor('#222222'))
        expect(selectSavedColors(store.getState())).toEqual(['#222222', '#aabbcc', '#111111'])
        await store.dispatch(removeSavedColor('#aabbcc'))
        expect(selectSavedColors(store.getState())).toEqual(['#222222', '#111111'])

        const full = makeStore(Array.from({ length: SAVED_COLORS_MAX }, (_, i) => `#0000${String(i).padStart(2, '0')}`))
        await full.dispatch(addSavedColor('#ffffff'))
        expect(selectSavedColors(full.getState())).toHaveLength(SAVED_COLORS_MAX)
        expect(selectSavedColors(full.getState())[0]).toBe('#ffffff')
        expect(selectSavedColors(full.getState())).not.toContain('#000015')
    })

    it('go back to what they were when the server refuses', async () => {
        const store = makeStore(['#111111'])
        apiFetch.mockRejectedValueOnce(new Error('down'))
        await expect(store.dispatch(addSavedColor('#333333'))).rejects.toThrow('down')
        expect(selectSavedColors(store.getState())).toEqual(['#111111'])
    })
})

describe('the colour picker', () => {
    function Picker({ start = null }) {
        const [value, setValue] = useState(start)
        return <><TaskColorPicker value={value} onChange={setValue} /><output data-testid="value">{String(value)}</output></>
    }
    const open = (store, start) => render(<Provider store={store}><Picker start={start} /></Provider>)

    it('offers my colours after the eight; the plus adds one from the wheel and picks it', async () => {
        const store = makeStore(['#2a9d8f'])
        open(store)
        fireEvent.click(screen.getByRole('radio', { name: 'Eigene Farbe #2a9d8f' }))
        expect(screen.getByTestId('value').textContent).toBe('#2a9d8f')

        fireEvent.click(screen.getByRole('button', { name: 'Farbe hinzufügen' }))
        const code = screen.getByRole('textbox')
        fireEvent.change(code, { target: { value: '#e76f51' } })
        fireEvent.keyDown(code, { key: 'Enter' })
        fireEvent.blur(code)
        fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }))
        expect(screen.getByTestId('value').textContent).toBe('#e76f51')
        await waitFor(() => expect(putBody()).toEqual({ colors: ['#e76f51', '#2a9d8f'] }))
        expect(screen.getByRole('radio', { name: 'Eigene Farbe #e76f51' }).checked).toBe(true)
        expect(screen.queryByRole('button', { name: 'Hinzufügen' })).toBeNull()
    })

    it("shows a thing's own colour that isn't one of mine as a swatch too", () => {
        open(makeStore([]), '#abcdef')
        expect(screen.getByRole('radio', { name: 'Eigene Farbe #abcdef' }).checked).toBe(true)
        expect(screen.getByRole('radio', { name: 'Keine Farbe' }).checked).toBe(false)
    })
})
