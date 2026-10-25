import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_USER } from '../features/auth/authActionTypes'
import { badgesFor } from '../features/profile/badges'
import UserProfile from '../components/UserProfile'
import ProfileView from '../components/ProfileView'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const HOUR = 60 * 60 * 1000
const apiError = (status, code) => Object.assign(new Error(code), { status, code })

// statistics like the api sends them (GET /api/profile(s))
const statsFixture = (overrides = {}) => ({
    today: '2026-10-21',
    totalMs: 12 * HOUR, sessions: 20, activeDays: 9, avgSessionMs: 36 * 60 * 1000, longestSessionMs: 2.5 * HOUR,
    currentStreak: 3, longestStreak: 8, todayMs: HOUR, weekMs: 4 * HOUR, lastWeekMs: 2 * HOUR, monthMs: 10 * HOUR,
    bestDay: { day: '2026-10-12', ms: 3 * HOUR }, weekdays: [HOUR, 2 * HOUR, 0, 0, 3 * HOUR, 0, 6 * HOUR],
    favoriteTime: 'evening', daily: [...Array(181).fill(0), HOUR],
    topGroups: [{ name: 'Mathe', color: 'blue', ms: 5 * HOUR }],
    tasksDone: 12, tasksDoneWeek: 4, friends: 3, sharedSessions: 2, sharedMs: HOUR,
    ...overrides,
})

const stranger = { id: 7, username: 'lena', displayName: 'Lena K.', relation: 'none' }
const friend = {
    id: 8, username: 'tom', displayName: 'Tom', relation: 'friend', memberSince: '2026-09-01T10:00:00Z',
    friendsSince: '2026-10-01T10:00:00Z', bio: 'Ich lerne gern abends.', status: 'Mathe-Klausur am Freitag',
    study: 'Informatik', interests: ['Physik', 'Schach'], color: 'teal', banner: 'aurora', emoji: '🦊',
    stats: statsFixture(), mutualFriends: [{ id: 9, username: 'mia', displayName: 'Mia' }], mutualFriendCount: 1,
}

async function renderPage(username) {
    const store = configureStore({ reducer: rootReducer })
    await act(async () => {
        render(
            <Provider store={store}>
                <MemoryRouter initialEntries={[`/u/${username}`]}>
                    <Routes>
                        <Route path="/u/:username" element={<UserProfile />} />
                        <Route path="/profile" element={<p>own profile</p>} />
                        <Route path="/inbox" element={<p>inbox</p>} />
                    </Routes>
                </MemoryRouter>
            </Provider>
        )
    })
    return store
}

describe('somebody else\'s profile', () => {
    beforeEach(() => { apiFetch.mockReset() })

    it('shows only the names to people who aren\'t friends, and offers to add them', async () => {
        apiFetch.mockImplementation(async (url, options = {}) => {
            if (url === '/api/profiles/lena') return stranger
            if (url === '/api/friends/requests' && options.method === 'POST') {
                return { status: 'pending', request: { id: 31, user: stranger, createdAt: '2026-10-21T10:00:00Z' } }
            }
            throw new Error(`unexpected ${url}`)
        })
        await renderPage('lena')

        expect(screen.getByRole('heading', { level: 1, name: 'Lena K.' })).toBeInTheDocument()
        expect(screen.getByText('@lena')).toBeInTheDocument()
        expect(screen.getByText(/Nur Freunde sehen mehr von Lena K\./)).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: /Statistik/ })).not.toBeInTheDocument()

        apiFetch.mockImplementation(async (url, options = {}) => {
            if (url === '/api/profiles/lena') return { ...stranger, relation: 'outgoing', requestId: 31 }
            if (options.method === 'POST') return { status: 'pending', request: { id: 31, user: stranger, createdAt: '2026-10-21T10:00:00Z' } }
            throw new Error(`unexpected ${url}`)
        })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Als Freund hinzufügen' })) })
        expect(JSON.parse(apiFetch.mock.calls.find(([url]) => url === '/api/friends/requests')[1].body)).toEqual({ username: 'lena' })
        expect(await screen.findByRole('button', { name: 'Anfrage zurückziehen' })).toBeInTheDocument()
        expect(screen.getByText(/Deine Anfrage wartet noch/)).toBeInTheDocument()
    })

    it('shows friends the whole profile, mutual friends and statistics', async () => {
        apiFetch.mockResolvedValue(friend)
        await renderPage('tom')

        expect(apiFetch).toHaveBeenCalledWith('/api/profiles/tom')
        expect(screen.getByRole('heading', { level: 1, name: 'Tom' })).toBeInTheDocument()
        expect(screen.getByText('Mathe-Klausur am Freitag')).toBeInTheDocument()
        expect(screen.getByText('Ich lerne gern abends.')).toBeInTheDocument()
        expect(screen.getByText('Physik')).toBeInTheDocument()
        expect(screen.getByText(/Informatik/)).toBeInTheDocument()
        expect(screen.getByText('🦊')).toBeInTheDocument()

        expect(screen.getByRole('heading', { name: 'Gemeinsame Freunde (1)' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Mia/ })).toHaveAttribute('href', '/u/mia')

        const stats = screen.getByRole('heading', { name: 'Statistik von Tom' }).closest('section')
        expect(within(stats).getByText('12 h 0 min')).toBeInTheDocument()
        expect(within(stats).getByText('🔥 3 Tage')).toBeInTheDocument()
        expect(within(stats).getByText('+100 % ggü. Vorwoche')).toBeInTheDocument()
        expect(within(stats).getByText('Abends')).toBeInTheDocument()
        expect(within(stats).getByRole('img', { name: /an 1 Tagen gelernt/ })).toBeInTheDocument()
        expect(within(stats).getByText('Mathe')).toBeInTheDocument()
        expect(within(stats).getByText('Abzeichen (4 von 10)')).toBeInTheDocument()

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Nachricht' })) })
        expect(screen.getByText('inbox')).toBeInTheDocument()
    })

    it('says so when a friend hides their statistics', async () => {
        apiFetch.mockResolvedValue({ ...friend, stats: null })
        await renderPage('tom')
        expect(screen.getByText('Tom zeigt die eigenen Statistiken nicht.')).toBeInTheDocument()
    })

    it('lets me answer a request right on the profile', async () => {
        apiFetch.mockImplementation(async (url, options = {}) => {
            if (url === '/api/profiles/lena') return { ...stranger, relation: 'incoming', requestId: 44 }
            if (url === '/api/friends/requests/44/accept' && options.method === 'POST') {
                return { friend: { ...stranger, since: '2026-10-21T10:00:00Z' } }
            }
            throw new Error(`unexpected ${url}`)
        })
        await renderPage('lena')
        apiFetch.mockImplementation(async (url, options = {}) => {
            if (url === '/api/profiles/lena') return { ...friend, ...stranger, relation: 'friend' }
            if (options.method === 'POST') return { friend: { ...stranger, since: '2026-10-21T10:00:00Z' } }
            throw new Error(`unexpected ${url}`)
        })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Annehmen' })) })
        expect(apiFetch).toHaveBeenCalledWith('/api/friends/requests/44/accept', expect.objectContaining({ method: 'POST' }))
        expect(await screen.findByText('Ich lerne gern abends.')).toBeInTheDocument()
    })

    it('sends me to my own profile page for my own name, and explains unknown names', async () => {
        apiFetch.mockResolvedValueOnce({ id: 1, username: 'jo', relation: 'self' })
        await renderPage('jo')
        expect(screen.getByText('own profile')).toBeInTheDocument()
    })

    it('explains unknown names', async () => {
        apiFetch.mockRejectedValueOnce(apiError(404, 'USER_NOT_FOUND'))
        await renderPage('nobody')
        expect(screen.getByRole('alert')).toHaveTextContent('Diesen Benutzer gibt es nicht.')
    })
})

describe('customizing my profile', () => {
    const me = { username: 'jo', display_name: 'Jo Berg', email: 'jo@example.com', created_at: '2026-08-15T12:00:00Z' }
    const own = { id: 1, username: 'jo', displayName: 'Jo Berg', relation: 'self', bio: null, status: null, study: null,
        interests: [], color: null, banner: null, emoji: null, showStats: true, shareActivity: true, level: 5, frame: null, title: null, showcase: [], stats: statsFixture({ sessions: 0, totalMs: 0, longestStreak: 0, longestSessionMs: 0, tasksDone: 0, sharedSessions: 0 }) }

    async function renderOwn() {
        const store = configureStore({ reducer: rootReducer })
        store.dispatch({ type: SET_USER, payload: [me] })
        await act(async () => {
            render(<Provider store={store}><MemoryRouter><ProfileView onSignOut={() => {}} /></MemoryRouter></Provider>)
        })
    }

    beforeEach(() => {
        apiFetch.mockReset()
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/profile') return own
            if (url === '/api/friends') return []
            return {}
        })
    })

    it('shows my numbers in short and links to the statistics page', async () => {
        await renderOwn()
        expect(apiFetch).toHaveBeenCalledWith('/api/profile')
        expect(screen.getByRole('link', { name: /Alle Statistiken/ })).toHaveAttribute('href', '/stats')
        // heat map and badges moved to the statistics page
        expect(screen.queryByText('Abzeichen (0 von 10)')).not.toBeInTheDocument()
    })

    it('previews the changes live and saves them', async () => {
        await renderOwn()
        fireEvent.click(screen.getByRole('button', { name: 'Profil gestalten' }))

        fireEvent.click(screen.getByRole('radio', { name: '📚' }))
        fireEvent.click(screen.getByRole('radio', { name: 'Türkis' }))
        fireEvent.click(screen.getByRole('radio', { name: 'Punkte' }))
        fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Lerne Bio' } })
        fireEvent.change(screen.getByLabelText('Über mich'), { target: { value: 'Hallo!' } })
        const tag = screen.getByLabelText(/Interessen/)
        fireEvent.change(tag, { target: { value: 'Chemie' } })
        fireEvent.keyDown(tag, { key: 'Enter' })
        fireEvent.change(tag, { target: { value: 'chemie' } })
        fireEvent.keyDown(tag, { key: 'Enter' })
        fireEvent.click(screen.getByLabelText(/Freunde dürfen meine Statistiken sehen/))

        // the card at the top already shows it
        expect(screen.getAllByText('Lerne Bio')).toHaveLength(1)
        expect(screen.getByText('Hallo!', { selector: 'p' })).toBeInTheDocument()

        const saved = { ...own, emoji: '📚', color: 'teal', banner: 'dots', status: 'Lerne Bio', bio: 'Hallo!', interests: ['Chemie'], showStats: false }
        apiFetch.mockImplementation(async (url, options = {}) => (url === '/api/profile' && options.method === 'PUT' ? saved : url === '/api/profile' ? own : []))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })) })

        const put = apiFetch.mock.calls.find(([url, options]) => url === '/api/profile' && options?.method === 'PUT')
        expect(JSON.parse(put[1].body)).toEqual({
            emoji: '📚', color: 'teal', banner: 'dots', frame: null, title: null, showcase: [], status: 'Lerne Bio', bio: 'Hallo!', study: '',
            interests: ['Chemie'], showStats: false, shareActivity: true,
        })
        expect(screen.getByText('Profil gespeichert.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument()
        expect(screen.getByText('📚')).toBeInTheDocument()
    })

    it('cancelling drops the preview', async () => {
        await renderOwn()
        fireEvent.click(screen.getByRole('button', { name: 'Profil gestalten' }))
        fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Nur probiert' } })
        fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
        expect(screen.queryByText('Nur probiert')).not.toBeInTheDocument()
    })
})

describe('badges', () => {
    it('follow from the numbers', () => {
        const earned = (stats) => badgesFor(stats).filter(b => b.earned).map(b => b.id)
        expect(earned(statsFixture({ sessions: 0, totalMs: 0, longestStreak: 0, longestSessionMs: 0, tasksDone: 0, sharedSessions: 0 }))).toEqual([])
        expect(earned(statsFixture())).toEqual(['firstSession', 'tenHours', 'streak7', 'marathon'])
        expect(earned(statsFixture({ favoriteTime: 'night', sharedSessions: 5 }))).toEqual(['firstSession', 'tenHours', 'streak7', 'marathon', 'teamPlayer', 'nightOwl'])
        expect(badgesFor(null).every(b => !b.earned)).toBe(true)
    })
})
