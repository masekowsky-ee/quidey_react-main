import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within, renderHook } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { readStoredUiVariant, setUiVariant, selectUiVariant, useApplyUiVariant, UI_VARIANT_IDS, setUiColors, selectColorChoice, readStoredUiColors } from '../features/tester/variants'
import { useApplyTheme } from '../features/settings/theme'
import { setAccent, setPalette } from '../features/settings/settingsAction'
import Settings from '../components/Settings'
import { openCommands } from '../features/tester/commands'
import Tester from '../components/tester/Tester'
import AdminTesterFeedback from '../components/tester/AdminTesterFeedback'
import CommandPalette from '../components/variants/CommandPalette'
import DepartureBoard from '../components/variants/DepartureBoard'
import Menu from '../components/Menu'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

function makeStore({ isTester = true, isAdmin = false } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'tina' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin, isTester: isTester || isAdmin, adminPendingCount: 0, betaRequest: null } })
    return store
}

function wrap(ui, store, path = '/') {
    return render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[path]}>
                <Routes><Route path="*" element={ui} /></Routes>
            </MemoryRouter>
        </Provider>
    )
}

let calls
let saved
function mockApi() {
    calls = []
    saved = { 'ui:schulheft': { topic: 'ui:schulheft', rating: 4, comment: 'Ruhig.', updatedAt: '2026-10-25T10:00:00Z' } }
    apiFetch.mockImplementation(async (url, options = {}) => {
        const body = options.body && JSON.parse(options.body)
        calls.push({ url, method: options.method ?? 'GET', body })
        if (url === '/api/tester/feedback') return Object.values(saved)
        if (url.startsWith('/api/tester/feedback/') && options.method === 'PUT') {
            const topic = decodeURIComponent(url.slice('/api/tester/feedback/'.length))
            const entry = { topic, rating: null, comment: null, ...saved[topic], ...body, updatedAt: '2026-10-25T11:00:00Z' }
            saved[topic] = entry
            return entry
        }
        throw new Error(`unexpected call ${options.method ?? 'GET'} ${url}`)
    })
}

beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.ui
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    apiFetch.mockReset()
})

describe('interface variants', () => {
    it('are remembered, and only testers get the one they picked', () => {
        expect(readStoredUiVariant()).toBe('current')
        const store = makeStore({ isTester: false })
        store.dispatch(setUiVariant('lesesaal'))
        expect(localStorage.getItem('uiVariant')).toBe('lesesaal')
        expect(readStoredUiVariant()).toBe('lesesaal')
        expect(selectUiVariant(store.getState())).toBe('current')
        store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isTester: true } })
        expect(selectUiVariant(store.getState())).toBe('lesesaal')
    })

    it('ignore unknown names', () => {
        const store = makeStore()
        store.dispatch(setUiVariant('neon'))
        expect(store.getState().settings.uiVariant).toBe('current')
        localStorage.setItem('uiVariant', 'neon')
        expect(readStoredUiVariant()).toBe('current')
    })

    it('go on <html data-ui>, and come off again', async () => {
        const store = makeStore()
        const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>
        renderHook(() => useApplyUiVariant(), { wrapper })
        expect(document.documentElement.dataset.ui).toBeUndefined()
        await act(async () => { store.dispatch(setUiVariant('tafel')) })
        // once its styles have loaded
        await vi.waitFor(() => expect(document.documentElement.dataset.ui).toBe('tafel'))
        await act(async () => { store.dispatch(setUiVariant('current')) })
        expect(document.documentElement.dataset.ui).toBeUndefined()
    })
})

describe('colours of the variants', () => {
    it('each variant has its own until another palette or accent is picked for it', () => {
        const store = makeStore()
        store.dispatch(setPalette('nord'))
        store.dispatch(setAccent('ocean'))
        expect(selectColorChoice(store.getState())).toEqual({ variant: 'current', palette: 'nord', accent: 'ocean' })
        store.dispatch(setUiVariant('lesesaal'))
        expect(selectColorChoice(store.getState())).toEqual({ variant: 'lesesaal', palette: 'own', accent: 'own' })
        store.dispatch(setUiColors('lesesaal', { accent: 'rose' }))
        expect(selectColorChoice(store.getState())).toEqual({ variant: 'lesesaal', palette: 'own', accent: 'rose' })
        // remembered per variant; the others and "current" keep theirs
        expect(readStoredUiColors()).toEqual({ lesesaal: { accent: 'rose' } })
        store.dispatch(setUiVariant('tafel'))
        expect(selectColorChoice(store.getState()).accent).toBe('own')
        store.dispatch(setUiVariant('current'))
        expect(selectColorChoice(store.getState())).toEqual({ variant: 'current', palette: 'nord', accent: 'ocean' })
    })

    it('ignores unknown colours and variants', () => {
        const store = makeStore()
        store.dispatch(setUiColors('schulheft', { palette: 'neon', accent: 'gold' }))
        store.dispatch(setUiColors('current', { accent: 'gold' }))
        expect(store.getState().settings.uiColors).toEqual({ schulheft: { accent: 'gold' } })
        localStorage.setItem('uiColors', '{"tafel":{"palette":"mono","accent":"x"},"nope":{"accent":"gold"}}')
        expect(readStoredUiColors()).toEqual({ tafel: { palette: 'mono' } })
        localStorage.setItem('uiColors', 'not json')
        expect(readStoredUiColors()).toEqual({})
    })

    it('go on <html data-palette> and <html data-accent>', () => {
        const store = makeStore()
        renderHook(() => useApplyTheme(), { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> })
        expect(document.documentElement.dataset.accent).toBe('sunset')
        act(() => { store.dispatch(setUiVariant('schulheft')) })
        expect(document.documentElement.dataset.palette).toBe('own')
        expect(document.documentElement.dataset.accent).toBe('own')
        act(() => { store.dispatch(setUiColors('schulheft', { palette: 'forest' })) })
        expect(document.documentElement.dataset.palette).toBe('forest')
    })

    it('the settings show the variant colours first and keep the choice for it', () => {
        const store = makeStore()
        store.dispatch(setUiVariant('tafel'))
        wrap(<Settings />, store, '/settings')
        const palettes = screen.getByRole('group', { name: 'Farbpalette' })
        const own = within(palettes).getAllByRole('button')[0]
        expect(own).toHaveTextContent('Abfahrtstafel')
        expect(own).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText(/Gilt nur für die Variante Abfahrtstafel/)).toBeInTheDocument()
        fireEvent.click(within(palettes).getByRole('button', { name: /Nord/ }))
        expect(store.getState().settings.uiColors.tafel).toEqual({ palette: 'nord' })
        expect(store.getState().settings.palette).toBe('warm')
        const accents = screen.getByRole('group', { name: 'Akzentfarbe' })
        expect(within(accents).getAllByRole('button')[0]).toHaveTextContent('Abfahrtstafel')
    })
})

describe('the Tester page', () => {
    it('lists every variant and the features in test, with my ratings', async () => {
        mockApi()
        const store = makeStore()
        await act(async () => { wrap(<Tester />, store, '/tester') })
        expect(screen.getByRole('heading', { level: 1, name: 'Testbereich' })).toBeInTheDocument()
        for (const name of ['Aktuell', 'Schulheft', 'Lesesaal', 'Übersicht', 'Abfahrtstafel']) {
            expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument()
        }
        expect(screen.getByRole('heading', { level: 3, name: 'Quidey Family' })).toBeInTheDocument()
        const schulheft = screen.getByRole('radiogroup', { name: 'Schulheft bewerten' })
        expect(within(schulheft).getByRole('radio', { name: '4 von 5 Sternen' })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByLabelText('Kommentar zu Schulheft')).toHaveValue('Ruhig.')
        // "current" is in use until another one is picked
        expect(screen.getAllByText('Aktiv')).toHaveLength(1)
    })

    it('switches the variant', async () => {
        mockApi()
        const store = makeStore()
        await act(async () => { wrap(<Tester />, store, '/tester') })
        fireEvent.click(screen.getByRole('button', { name: 'Lesesaal: Verwenden' }))
        expect(store.getState().settings.uiVariant).toBe('lesesaal')
        expect(screen.queryByRole('button', { name: 'Lesesaal: Verwenden' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Aktuell: Verwenden' })).toBeInTheDocument()
    })

    it('saves a star at once and a comment with its button', async () => {
        mockApi()
        const store = makeStore()
        await act(async () => { wrap(<Tester />, store, '/tester') })
        const tafel = screen.getByRole('radiogroup', { name: 'Abfahrtstafel bewerten' })
        await act(async () => { fireEvent.click(within(tafel).getByRole('radio', { name: '2 von 5 Sternen' })) })
        expect(calls.at(-1)).toEqual({ url: '/api/tester/feedback/ui%3Atafel', method: 'PUT', body: { rating: 2 } })
        expect(within(tafel).getByRole('radio', { name: '2 von 5 Sternen' })).toHaveAttribute('aria-checked', 'true')

        const field = screen.getByLabelText('Kommentar zu Online-Status')
        fireEvent.change(field, { target: { value: '  Der grüne Punkt ist super  ' } })
        const row = field.closest('li')
        await act(async () => { fireEvent.click(within(row).getByRole('button', { name: 'Speichern' })) })
        expect(calls.at(-1)).toEqual({ url: '/api/tester/feedback/feature%3Apresence', method: 'PUT', body: { comment: 'Der grüne Punkt ist super' } })
        expect(within(row).getByRole('status')).toHaveTextContent('Gespeichert')
        expect(within(row).getByRole('button', { name: 'Speichern' })).toBeDisabled()

        // the same star again takes it away
        await act(async () => { fireEvent.click(within(tafel).getByRole('radio', { name: '2 von 5 Sternen' })) })
        expect(calls.at(-1).body).toEqual({ rating: null })
    })

    it('ranks my variants once two have stars', async () => {
        mockApi()
        const store = makeStore()
        await act(async () => { wrap(<Tester />, store, '/tester') })
        expect(screen.getByText('Bewerte mindestens zwei Varianten, dann siehst du hier deine Reihenfolge.')).toBeInTheDocument()
        const lesesaal = screen.getByRole('radiogroup', { name: 'Lesesaal bewerten' })
        await act(async () => { fireEvent.click(within(lesesaal).getByRole('radio', { name: '5 von 5 Sternen' })) })
        const ranking = screen.getByRole('list', { name: 'Dein Vergleich' })
        const items = within(ranking).getAllByRole('listitem')
        expect(items[0]).toHaveTextContent('Lesesaal')
        expect(items[0]).toHaveTextContent('Favorit')
        expect(items[1]).toHaveTextContent('Schulheft')
    })
})

describe('the menu', () => {
    it('has the Tester entry beside admin, for testers only', () => {
        const tester = makeStore()
        const { unmount } = wrap(<Menu />, tester)
        expect(screen.getByRole('link', { name: 'Tester' })).toHaveAttribute('href', '/tester')
        unmount()
        wrap(<Menu />, makeStore({ isTester: false }))
        expect(screen.queryByRole('link', { name: 'Tester' })).toBeNull()
    })
})

describe('the admin view of tester feedback', () => {
    it('shows averages, favourites and comments per topic', async () => {
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/admin/tester-feedback') return {
                testers: 2,
                topics: [
                    { topic: 'ui:schulheft', ratings: 2, average: 3.5, spread: [0, 1, 0, 0, 1], entries: [
                        { user: { id: 1, username: 'tina', displayName: 'Tina' }, rating: 5, comment: 'Wie mein Heft!', updatedAt: '2026-10-25T10:00:00Z' },
                        { user: { id: 2, username: 'timo', displayName: 'Timo' }, rating: 2, comment: null, updatedAt: '2026-10-25T09:00:00Z' },
                    ] },
                    { topic: 'ui:tafel', ratings: 1, average: 4, spread: [0, 0, 0, 1, 0], entries: [
                        { user: { id: 2, username: 'timo', displayName: 'Timo' }, rating: 4, comment: null, updatedAt: '2026-10-25T09:00:00Z' },
                    ] },
                    { topic: 'feature:old-thing', ratings: 0, average: null, spread: [0, 0, 0, 0, 0], entries: [
                        { user: { id: 1, username: 'tina', displayName: 'Tina' }, rating: null, comment: 'War gut', updatedAt: '2026-10-20T10:00:00Z' },
                    ] },
                ],
            }
            throw new Error(`unexpected ${url}`)
        })
        await act(async () => { wrap(<AdminTesterFeedback />, makeStore({ isAdmin: true })) })
        expect(screen.getByText('2 Tester haben etwas gesagt.')).toBeInTheDocument()
        const schulheft = screen.getByRole('heading', { name: 'Schulheft' }).closest('li')
        expect(schulheft).toHaveTextContent('Ø 3,5 · 2 Bewertungen')
        expect(schulheft).toHaveTextContent('Favorit von 1')
        expect(schulheft).toHaveTextContent('Wie mein Heft!')
        expect(screen.getByRole('heading', { name: 'Abfahrtstafel' }).closest('li')).toHaveTextContent('Favorit von 1')
        // a topic that is no longer in test still shows
        expect(screen.getByRole('heading', { name: 'Frühere Themen' })).toBeInTheDocument()
        expect(screen.getByText('War gut')).toBeInTheDocument()
    })
})

describe('the command bar', () => {
    it('opens on Ctrl K, narrows by typing and runs with Enter', async () => {
        const store = makeStore()
        store.dispatch(setUiVariant('uebersicht'))
        wrap(<CommandPalette />, store)
        expect(screen.queryByRole('dialog')).toBeNull()
        await act(async () => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }) })
        const input = screen.getByRole('combobox')
        fireEvent.change(input, { target: { value: 'neue' } })
        expect(screen.getAllByRole('option')).toHaveLength(1)
        await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
        expect(store.getState().settings.showForms).toBe(true)
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('finds a place without umlauts and switches variants', async () => {
        const store = makeStore()
        store.dispatch(setUiVariant('uebersicht'))
        wrap(<CommandPalette />, store)
        await act(async () => { openCommands() })
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tafel' } })
        await act(async () => { fireEvent.click(screen.getByRole('option', { name: /Abfahrtstafel/ })) })
        expect(store.getState().settings.uiVariant).toBe('tafel')
        await act(async () => { openCommands() })
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ubersi' } })
        expect(screen.getByRole('option', { name: /Übersicht/ })).toBeInTheDocument()
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'xyz' } })
        expect(screen.getByText('Nichts gefunden für „xyz“.')).toBeInTheDocument()
    })
})

describe('the departure board', () => {
    const at = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
    const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

    it('lists today by time with what is about to happen', () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        const now = new Date(); now.setHours(10, 0, 0, 0)
        vi.setSystemTime(now)
        const tasks = [
            { id: 1, name: 'Vorlesung', kind: 'event', due: todayKey(), due_time: at(10, 10), duration_minutes: 90, done: false },
            { id: 2, name: 'Mathe Blatt', kind: 'task', due: todayKey(), due_time: null, done: false },
            { id: 3, name: 'Seminar', kind: 'event', due: todayKey(), due_time: at(9, 30), duration_minutes: 60, done: false },
            { id: 4, name: 'Bericht', kind: 'task', due: '2020-01-02', due_time: null, done: false },
            { id: 5, name: 'Erledigt', kind: 'task', due: todayKey(), done: true },
        ]
        wrap(<DepartureBoard tasks={tasks} activeTask={null} />, makeStore())
        const rows = screen.getAllByRole('row').slice(1)
        expect(rows.map(row => row.cells[1].textContent)).toEqual(['Bericht', 'Seminar', 'Vorlesung', 'Mathe Blatt'])
        expect(rows[0]).toHaveTextContent('überfällig')
        expect(rows[1]).toHaveTextContent('läuft')
        expect(rows[2]).toHaveTextContent('in 10 Min')
        expect(rows[2]).toHaveAttribute('data-state', 'soon')
        expect(rows[3]).toHaveTextContent('heute')
        vi.useRealTimers()
    })

    it('says when nothing is left', () => {
        wrap(<DepartureBoard tasks={[]} activeTask={null} />, makeStore())
        expect(screen.getByText(/Heute steht nichts mehr an/)).toBeInTheDocument()
    })
})

it('every variant has its texts', () => {
    const store = makeStore()
    for (const id of UI_VARIANT_IDS) store.dispatch(setUiVariant(id))
    expect(store.getState().settings.uiVariant).toBe(UI_VARIANT_IDS.at(-1))
})
