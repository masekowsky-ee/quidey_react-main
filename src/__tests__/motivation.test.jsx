import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_FRIENDS } from '../features/friends/friendsActionTypes'
import { rememberPresence } from '../features/presence/presence'
import { fetchProgress, nextStreakMilestone } from '../features/progress/progress'
import { readStoredPalette } from '../features/settings/preferences'
import Menu from '../components/Menu'
import Social from '../components/Social'
import Settings from '../components/Settings'
import PasswordInput from '../components/PasswordInput'
import Momentum from '../components/home/Momentum'
import LevelPlant from '../components/progress/LevelPlant'
import PlantCard from '../components/progress/PlantCard'
import { useApplyTheme } from '../features/settings/theme'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const ANN = { id: 2, username: 'ann', displayName: 'Ann', level: 7 }
const BEN = { id: 3, username: 'ben', displayName: 'Ben', level: 2 }

const PROGRESS = {
    today: '2026-10-25', weekStart: '2026-10-19', xp: 520, sources: { focus: 400, tasks: 45, challenges: 75 },
    level: 3, unlockLevel: 3, levelStartXp: 375, nextLevelXp: 675, shareActivity: true,
    streak: 5, streakToday: false, bestStreak: 9, todayFocusMin: 0, streakMilestones: [3, 7, 14, 30],
    recentDays: ['19', '20', '21', '22', '23', '24', '25'].map((d, i) => ({ day: `2026-10-${d}`, active: i > 0 && i < 6 })),
    daily: [
        { id: 'focus45', goal: 45, value: 18, xp: 40, done: false, period: 'day' },
        { id: 'tasks3', goal: 3, value: 3, xp: 30, done: true, period: 'day' },
        { id: 'sessions2', goal: 2, value: 0, xp: 25, done: false, period: 'day' },
    ],
    weekly: [],
}

const makeStore = () => configureStore({ reducer: rootReducer })
const renderWith = (store, ui) => render(<Provider store={store}><MemoryRouter>{ui}</MemoryRouter></Provider>)

beforeEach(() => {
    localStorage.clear()
    apiFetch.mockReset()
    apiFetch.mockResolvedValue([])
})
afterEach(() => {
    vi.useRealTimers()
})

describe('online status', () => {
    it('the menu shows how many friends are online, and follows them live', () => {
        const store = makeStore()
        store.dispatch({ type: SET_FRIENDS, payload: [{ ...ANN, online: true }, { ...BEN, online: false }] })
        renderWith(store, <Menu />)
        expect(screen.getByRole('link', { name: /1 Freund online: Ann/ })).toHaveAttribute('href', '/community/friends')

        act(() => { store.dispatch(rememberPresence([{ user: BEN, online: true }])) })
        expect(screen.getByRole('link', { name: /2 Freunde online: Ann, Ben/ })).toBeInTheDocument()

        act(() => { store.dispatch(rememberPresence([{ user: ANN, online: false }, { user: BEN, online: false }])) })
        expect(screen.queryByRole('link', { name: /online/ })).not.toBeInTheDocument()
    })

    it('the friends list puts who is online first and says so', async () => {
        apiFetch.mockImplementation(async (url) => (url === '/api/friends'
            ? [{ ...ANN, online: false }, { ...BEN, online: true }]
            : { incoming: [], outgoing: [] }))
        const store = makeStore()
        await act(async () => { renderWith(store, <Social />) })
        const rows = screen.getAllByRole('listitem')
        expect(within(rows[0]).getByRole('link', { name: 'Ben' })).toBeInTheDocument()
        expect(within(rows[0]).getByText('online')).toBeInTheDocument()
        expect(within(rows[1]).queryByText('online')).not.toBeInTheDocument()
    })
})

describe('password fields', () => {
    it('the eye shows what was typed and hides it again', () => {
        renderWith(makeStore(), <><label htmlFor="pw">Passwort</label><PasswordInput id="pw" defaultValue="geheim123" /></>)
        const field = screen.getByLabelText('Passwort')
        expect(field).toHaveAttribute('type', 'password')
        fireEvent.click(screen.getByRole('button', { name: 'Passwort anzeigen' }))
        expect(field).toHaveAttribute('type', 'text')
        expect(screen.getByRole('button', { name: 'Passwort verbergen' })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(screen.getByRole('button', { name: 'Passwort verbergen' }))
        expect(field).toHaveAttribute('type', 'password')
    })
})

describe('colour palettes', () => {
    function Themed() {
        useApplyTheme()
        return <Settings />
    }

    it('a palette is applied to the page and remembered', () => {
        window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
        renderWith(makeStore(), <Themed />)
        expect(document.documentElement.dataset.palette).toBe('warm')
        fireEvent.click(screen.getByRole('button', { name: 'Nord' }))
        expect(screen.getByRole('button', { name: 'Nord' })).toHaveAttribute('aria-pressed', 'true')
        expect(document.documentElement.dataset.palette).toBe('nord')
        expect(readStoredPalette()).toBe('nord')
        delete window.matchMedia
    })

    it('an unknown saved palette falls back to the default', () => {
        localStorage.setItem('palette', 'neon')
        expect(readStoredPalette()).toBe('warm')
    })
})

describe('streak', () => {
    it('Home shows the streak, the last seven days, and that today is still open', async () => {
        apiFetch.mockImplementation(async (url) => (url === '/api/progress/friends'
            ? { weekStart: '2026-10-19', ranking: [{ user: ANN, weekXp: 100, streak: 12, me: false }, { user: BEN, weekXp: 50, streak: 0, me: false }] }
            : []))
        const store = makeStore()
        store.dispatch({ type: 'PROGRESS_LOADED', payload: PROGRESS })
        store.dispatch({ type: SET_FRIENDS, payload: [{ ...ANN, online: true }, { ...BEN, online: false }] })
        await act(async () => { renderWith(store, <Momentum />) })

        const streak = screen.getByRole('heading', { name: 'Deine Serie' }).closest('section')
        expect(streak).toHaveAttribute('data-streak', 'waiting')
        expect(within(streak).getByText('5')).toBeInTheDocument()
        expect(within(streak).getByText(/Heute fehlt noch/)).toBeInTheDocument()
        expect(within(streak).getByText('Noch 2 Tage bis 7')).toBeInTheDocument()
        expect(within(streak).getByText('Rekord: 9')).toBeInTheDocument()
        expect(within(streak).getAllByRole('listitem')).toHaveLength(7)

        const today = screen.getByRole('heading', { name: 'Heute' }).closest('section')
        expect(within(today).getByText('1 von 3')).toBeInTheDocument()

        const friends = screen.getByRole('heading', { name: 'Freunde' }).closest('section')
        expect(within(friends).getByText('1 Freund online')).toBeInTheDocument()
        // Ann: her face (online) and her streak
        expect(within(friends).getAllByRole('link', { name: 'Ann' })).toHaveLength(2)
        // the streaks of friends: Ann's, Ben has none
        expect(within(friends).getByLabelText('12 Tage in Folge')).toBeInTheDocument()
    })

    it('the next milestone after a streak', () => {
        expect(nextStreakMilestone(0)).toBe(3)
        expect(nextStreakMilestone(5)).toBe(7)
        expect(nextStreakMilestone(400)).toBe(null)
    })

    it('reminds once in the evening while today is still open', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(2026, 9, 25, 19, 30))
        apiFetch.mockResolvedValue(PROGRESS)
        const store = makeStore()
        await act(async () => { await store.dispatch(fetchProgress()) })
        expect(store.getState().toast.map(toast => toast.text)).toContain('Deine Serie von 5 Tagen wartet auf heute')
        await act(async () => { await store.dispatch(fetchProgress()) })
        expect(store.getState().toast.filter(toast => toast.text.includes('wartet'))).toHaveLength(1)
    })

    it('not in the morning', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(2026, 9, 25, 9, 0))
        apiFetch.mockResolvedValue(PROGRESS)
        const store = makeStore()
        await act(async () => { await store.dispatch(fetchProgress()) })
        expect(store.getState().toast).toHaveLength(0)
    })

    it('celebrates a milestone when today makes it', async () => {
        const store = makeStore()
        apiFetch.mockResolvedValue({ ...PROGRESS, streak: 6, streakToday: false })
        await act(async () => { await store.dispatch(fetchProgress()) })
        apiFetch.mockResolvedValue({ ...PROGRESS, streak: 7, streakToday: true })
        await act(async () => { await store.dispatch(fetchProgress()) })
        expect(store.getState().toast.map(toast => toast.text)).toContain('🔥 7 Tage in Folge!')
    })
})

describe('the level plant', () => {
    it('grows from a seed in a pot to trees on an island', () => {
        const { container, rerender } = render(<LevelPlant level={1} />)
        const frame = () => container.firstChild
        expect(frame()).toHaveAttribute('data-tier', 'seed')
        const seedParts = container.querySelectorAll('g > g > *').length
        rerender(<LevelPlant level={8} />)
        expect(frame()).toHaveAttribute('data-tier', 'sapling')
        expect(container.querySelectorAll('g > g > *').length).toBeGreaterThan(seedParts)
        rerender(<LevelPlant level={22} />)
        expect(frame()).toHaveAttribute('data-tier', 'grove')
        rerender(<LevelPlant level={50} label="Pflanze auf Level 50: Urwald" />)
        expect(screen.getByRole('img', { name: 'Pflanze auf Level 50: Urwald' })).toHaveAttribute('data-tier', 'ancient')
    })

    it('the profile card replays the growth and leafs through the levels', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
        const store = makeStore()
        store.dispatch({ type: 'PROGRESS_LOADED', payload: { ...PROGRESS, level: 12, levelStartXp: 0, nextLevelXp: 100, xp: 50 } })
        renderWith(store, <PlantCard />)
        expect(screen.getByRole('img', { name: 'Pflanze auf Level 12: Strauch' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Wachstum ansehen' }))
        expect(screen.getByRole('img', { name: 'Pflanze auf Level 1: Samenkorn' })).toBeInTheDocument()
        await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
        expect(screen.getByRole('img', { name: 'Pflanze auf Level 12: Strauch' })).toBeInTheDocument()

        fireEvent.change(screen.getByRole('slider'), { target: { value: '4' } })
        expect(screen.getByRole('img', { name: 'Pflanze auf Level 4: Keimling' })).toBeInTheDocument()
        expect(screen.getByText(/so sah sie aus/)).toBeInTheDocument()
    })
})
