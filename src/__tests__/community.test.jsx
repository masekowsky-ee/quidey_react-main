import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS } from '../features/auth/authActionTypes'
import { fetchProgress, levelStartXp, requiredLevel, tierFor, UNLOCKS, nextUnlocks } from '../features/progress/progress'
import { sectionAt } from '../features/realtime/news'
import { isCommunityPath } from '../features/community/paths'
import Community from '../components/community/Community'
import ProfileEditor from '../components/profile/ProfileEditor'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const ANN = { id: 2, username: 'ann', displayName: 'Ann', level: 7 }
const ME = { id: 1, username: 'me', displayName: 'Me', level: 3 }

const challenge = (id, goal, value, xp, done = false) => ({ id, goal, value, xp, done, completedAt: null })
const PROGRESS = {
    today: '2026-10-25', weekStart: '2026-10-19', xp: 520, sources: { focus: 400, tasks: 45, challenges: 75 },
    level: 3, unlockLevel: 3, levelStartXp: 375, nextLevelXp: 675, streak: 4, shareActivity: true,
    daily: [
        { ...challenge('focus45', 45, 18, 40), period: 'day' },
        { ...challenge('tasks3', 3, 3, 30, true), period: 'day' },
        { ...challenge('cheer2', 2, 0, 20), period: 'day' },
    ],
    weekly: [
        { ...challenge('week5h', 300, 130, 200), period: 'week' },
        { ...challenge('days5', 5, 2, 250), period: 'week' },
    ],
}
const RANKING = { weekStart: '2026-10-19', ranking: [
    { user: ANN, weekXp: 610, me: false },
    { user: ME, weekXp: 240, me: true },
] }
const today = new Date().toISOString()
const FEED = { next: null, entries: [
    { id: 11, kind: 'day', day: '2026-10-25', data: { focusMs: 80 * 60000, sessions: 2, tasksDone: 1 }, createdAt: today, updatedAt: today, user: ANN, mine: false, cheers: 1, cheered: false },
    { id: 12, kind: 'post', day: null, data: { text: 'Kapitel 4 geschafft' }, createdAt: today, updatedAt: today, user: ME, mine: true, cheers: 1, cheered: false, cheerers: [ANN] },
    { id: 13, kind: 'challenge', day: null, data: { challenge: 'focus45', goal: 45, xp: 40, weekly: false }, createdAt: today, updatedAt: today, user: ANN, mine: false, cheers: 0, cheered: false },
] }

// routes: { 'GET /api/...': answer or (options) => answer }
const api = (routes) => apiFetch.mockImplementation(async (url, options = {}) => {
    const key = `${options.method ?? 'GET'} ${url}`
    if (!(key in routes)) {
        if (url.startsWith('/api/friends') || url.startsWith('/api/shared-sessions') || url.startsWith('/api/tester')) return []
        throw new Error(`unexpected call ${key}`)
    }
    const route = routes[key]
    return typeof route === 'function' ? route(options) : route
})
const COMMUNITY = { 'GET /api/progress': PROGRESS, 'GET /api/progress/friends': RANKING, 'GET /api/feed': FEED }

function Where() {
    return <output data-testid="where">{useLocation().pathname}</output>
}

async function renderCommunity(path = '/community', { tester = false } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isTester: tester } })
    await act(async () => {
        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={[path]}>
                    <Routes>
                        <Route path="/community" element={<Community />} />
                        <Route path="/community/:tab" element={<Community />} />
                    </Routes>
                    <Where />
                </MemoryRouter>
            </Provider>
        )
    })
    return store
}

describe('levels and unlocks', () => {
    it('each level needs 75 XP more than the one before', () => {
        expect([1, 2, 3, 4, 10, 20].map(levelStartXp)).toEqual([0, 150, 375, 675, 4050, 15675])
    })

    it('names the levels after how a plant grows', () => {
        expect(tierFor(1).id).toBe('seed')
        expect(tierFor(5).id).toBe('sprout')
        expect(tierFor(10).id).toBe('shrub')
        expect(tierFor(99).id).toBe('ancient')
    })

    it('knows which level each profile choice needs', () => {
        expect(requiredLevel('banner', 'gradient')).toBe(1)
        expect(requiredLevel('banner', 'aurora')).toBe(8)
        expect(requiredLevel('banner', 'sky')).toBe(24)
        expect(requiredLevel('color', 'red')).toBe(1)
        expect(requiredLevel('color', 'violet')).toBe(4)
        expect(requiredLevel('emoji', '📚')).toBe(1)
        expect(requiredLevel('emoji', '🪐')).toBe(12)
        expect(requiredLevel('frame', 'orbit')).toBe(30)
        expect(requiredLevel('title', 'seed')).toBe(5)
        expect(requiredLevel('frame', null)).toBe(1)
    })

    it('lists the unlocks level by level, and the next ones after mine', () => {
        const levels = UNLOCKS.map(step => step.level)
        expect(levels).toEqual([...levels].sort((a, b) => a - b))
        expect(UNLOCKS.find(step => step.level === 8).items).toContainEqual({ kind: 'banner', value: 'aurora' })
        expect(nextUnlocks(3).map(step => step.level)).toEqual([4, 5, 6])
    })
})

describe('progress toasts', () => {
    beforeEach(() => { apiFetch.mockReset() })

    it('the first look says nothing; a challenge done since and a level up come with a toast', async () => {
        const store = configureStore({ reducer: rootReducer })
        api({ 'GET /api/progress': PROGRESS })
        await store.dispatch(fetchProgress())
        expect(store.getState().toast).toEqual([])

        const later = {
            ...PROGRESS, level: 4, xp: 700, levelStartXp: 675, nextLevelXp: 1050,
            daily: PROGRESS.daily.map(c => (c.id === 'focus45' ? { ...c, value: 45, done: true } : c)),
        }
        api({ 'GET /api/progress': later })
        await store.dispatch(fetchProgress())
        expect(store.getState().toast.map(toast => toast.text)).toEqual(['Challenge geschafft: +40 XP', 'Level 4 erreicht'])
        expect(store.getState().toast[0]).toMatchObject({ detail: '45 Minuten fokussieren', to: '/community/progress' })
    })

    it('a new day with other challenges is not news', async () => {
        const store = configureStore({ reducer: rootReducer })
        api({ 'GET /api/progress': PROGRESS })
        await store.dispatch(fetchProgress())
        api({ 'GET /api/progress': { ...PROGRESS, today: '2026-10-26', daily: [{ ...challenge('focus25', 25, 25, 25, true), period: 'day' }] } })
        await store.dispatch(fetchProgress())
        expect(store.getState().toast).toEqual([])
    })
})

describe('Gemeinschaft page', () => {
    beforeEach(() => { apiFetch.mockReset() })

    it('leads with my level, then the tabs and the feed; level and challenges have their own tab', async () => {
        api(COMMUNITY)
        await renderCommunity()
        expect(screen.getByRole('heading', { level: 1, name: 'Gemeinschaft' })).toBeInTheDocument()
        expect(screen.getByText('Level 3 · Keimling · noch 155 XP bis Level 4')).toBeInTheDocument()
        const tabs = screen.getByRole('navigation', { name: 'Bereiche der Gemeinschaft' })
        expect(within(tabs).getAllByRole('link').map(link => link.textContent)).toEqual(['Feed', 'Fortschritt', 'Sitzungen', 'Freunde', 'Family'])
        expect(within(tabs).getByRole('link', { name: 'Fortschritt' })).toHaveAttribute('href', '/community/progress')
        // the feed has no level card or challenges beside it any more
        expect(screen.queryByRole('progressbar', { name: '520 von 675 XP' })).not.toBeInTheDocument()
        expect(screen.queryByRole('region', { name: 'Heute' })).not.toBeInTheDocument()
    })

    it('the progress tab shows my level and streak', async () => {
        api(COMMUNITY)
        await renderCommunity('/community/progress')
        expect(screen.getByRole('progressbar', { name: '520 von 675 XP' })).toHaveAttribute('aria-valuenow', '520')
        expect(screen.getByText('4 Tage Serie')).toBeInTheDocument()
    })

    it("shows today's and this week's challenges with how far I am", async () => {
        api(COMMUNITY)
        await renderCommunity('/community/progress')
        const todayList = screen.getByRole('region', { name: 'Heute' })
        expect(within(todayList).getByText('1 von 3 · bis Mitternacht')).toBeInTheDocument()
        expect(within(todayList).getByText('18 / 45 Min.')).toBeInTheDocument()
        expect(within(todayList).getByText('Geschafft')).toBeInTheDocument()
        const week = screen.getByRole('region', { name: 'Diese Woche' })
        expect(within(week).getByText('5 Stunden fokussieren')).toBeInTheDocument()
        expect(within(week).getByText('2,2 / 5 Std.')).toBeInTheDocument()
    })

    it('ranks the week among friends, me in bold', async () => {
        api(COMMUNITY)
        await renderCommunity('/community/progress')
        const ranking = screen.getByRole('region', { name: 'Diese Woche unter Freund:innen' })
        const rows = within(ranking).getAllByRole('listitem')
        expect(rows.map(row => row.textContent)).toEqual(['1AAnnLv 7610 XP', '2MDuLv 3240 XP'])
        expect(within(ranking).getByRole('link', { name: /Ann/ })).toHaveAttribute('href', '/u/ann')
    })

    it("tells what friends did, and cheers them on", async () => {
        let cheered = false
        api({ ...COMMUNITY, 'PUT /api/feed/11/cheer': () => { cheered = true; return { cheers: 2, cheered: true } },
            'GET /api/progress': PROGRESS })
        await renderCommunity()
        expect(screen.getByText(/hat 1 h 20 min fokussiert/)).toBeInTheDocument()
        expect(screen.getByText(/2 Sitzungen · 1 Aufgabe/)).toBeInTheDocument()
        expect(screen.getByText(/hat eine Tages-Challenge geschafft/)).toBeInTheDocument()
        expect(screen.getByText(/45 Minuten fokussieren · \+40 XP/)).toBeInTheDocument()
        expect(screen.getByText('Angefeuert von Ann')).toBeInTheDocument()

        const [cheer] = screen.getAllByRole('button', { name: 'Ann anfeuern' })
        await act(async () => { fireEvent.click(cheer) })
        expect(cheered).toBe(true)
        const undo = screen.getByRole('button', { name: 'Anfeuern zurücknehmen' })
        expect(undo).toHaveAttribute('aria-pressed', 'true')
        expect(undo).toHaveTextContent('Angefeuert2')
    })

    it('shares a post with friends', async () => {
        const post = { id: 20, kind: 'post', day: null, data: { text: 'Pause' }, createdAt: today, updatedAt: today, user: ME, mine: true, cheers: 0, cheered: false, cheerers: [] }
        api({ ...COMMUNITY, 'POST /api/feed/posts': (options) => { expect(JSON.parse(options.body)).toEqual({ text: 'Pause' }); return post } })
        await renderCommunity()
        const field = screen.getByLabelText('Teile, woran du gerade arbeitest')
        const share = screen.getByRole('button', { name: 'Teilen' })
        expect(share).toBeDisabled()
        fireEvent.change(field, { target: { value: '  Pause ' } })
        await act(async () => { fireEvent.click(share) })
        expect(field).toHaveValue('')
        expect(screen.getByText('Pause')).toBeInTheDocument()
    })

    it('an empty feed says what to do', async () => {
        api({ ...COMMUNITY, 'GET /api/feed': { entries: [], next: null } })
        await renderCommunity()
        expect(screen.getByText('Hier ist noch nichts los.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Freund:innen finden' })).toHaveAttribute('href', '/community/friends?tab=add')
    })

    it('the family tab is for everybody; an unknown tab leads to the feed', async () => {
        api(COMMUNITY)
        await renderCommunity('/community/family')
        expect(screen.getByTestId('where')).toHaveTextContent('/community/family')
        await renderCommunity('/community/nothing')
        expect(screen.getAllByTestId('where').at(-1)).toHaveTextContent(/^\/community$/)
    })
})

describe('the menu and its dots', () => {
    it('everything with other people belongs to the page', () => {
        expect(['/community', '/community/friends', '/together/4', '/family/2', '/u/ann'].every(isCommunityPath)).toBe(true)
        expect(['/', '/calendar', '/communityx'].some(isCommunityPath)).toBe(false)
        expect(sectionAt('/community')).toBe('feed')
        expect(sectionAt('/community/friends')).toBe('social')
        expect(sectionAt('/community/sessions')).toBe('together')
        expect(sectionAt('/together/3')).toBe(null)
    })
})

describe('profile choices by level', () => {
    it("locks what my level hasn't reached, but keeps what I already have", async () => {
        const store = configureStore({ reducer: rootReducer })
        const profile = { username: 'me', level: 5, banner: 'sky', stats: null, showcase: [] }
        await act(async () => {
            render(<Provider store={store}><ProfileEditor profile={profile} onSaved={() => {}} onClose={() => {}} /></Provider>)
        })
        expect(screen.getByRole('radio', { name: 'Streifen' })).toBeEnabled()
        expect(screen.getByRole('radio', { name: 'Polarlicht, ab Level 8' })).toBeDisabled()
        expect(screen.getByRole('radio', { name: 'Sternenhimmel' })).toBeChecked()
        expect(screen.getByRole('radio', { name: 'Ring, ab Level 10' })).toBeDisabled()
        expect(screen.getByRole('radio', { name: 'Planungsprofi' })).toBeEnabled()
        expect(screen.getByRole('radio', { name: 'Mentor:in, ab Level 25' })).toBeDisabled()
        expect(screen.getByText('ab Level 18')).toBeInTheDocument()
    })
})
