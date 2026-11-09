import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import {
    worthSending, bestsByGame, bestOf, readMode, storeMode, nextTile, reflexLifeMs, reflexPoints, growPattern, patternStepMs, ARCADE_GAMES,
} from '../features/arcade/arcade'
import ArcadePage from '../components/arcade/ArcadePage'
import Reflex from '../components/arcade/Reflex'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

function makeStore() {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'ann' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, isAdmin: false, isTester: false, userId: 1 } })
    return store
}
const sent = (method, url) => apiFetch.mock.calls.filter(([u, o = {}]) => u === url && (o.method ?? 'GET') === method)

describe('arcade rules', () => {
    beforeEach(() => localStorage.clear())

    it('a score is sent only when it beats what its mode has', () => {
        const known = { best: 10, rankedBest: 5 }
        expect(worthSending(known, 0, true)).toBe(false)
        expect(worthSending(known, 8, false)).toBe(false)
        expect(worthSending(known, 8, true)).toBe(true)
        expect(worthSending(known, 11, false)).toBe(true)
        expect(worthSending({ best: 10, rankedBest: null }, 3, true)).toBe(true)
    })

    it('bests are looked up per game and difficulty', () => {
        const bests = bestsByGame([{ game: 'guess', level: 'hard', best: 4, rankedBest: null }])
        expect(bestOf(bests, 'guess', 'hard').best).toBe(4)
        expect(bestOf(bests, 'guess', 'easy')).toEqual({ best: 0, rankedBest: null })
        expect(bestsByGame(null).size).toBe(0)
    })

    it('the mode is remembered; nothing stored means just for me', () => {
        expect(readMode()).toBe('casual')
        storeMode('ranked')
        expect(readMode()).toBe('ranked')
    })

    it('reflex: never the same tile twice, shorter lights, quick hits count double', () => {
        for (let i = 0; i < 50; i++) expect(nextTile(3, Math.random)).not.toBe(3)
        expect(nextTile(null, () => 0.999)).toBe(14)
        expect(reflexLifeMs(7)).toBe(reflexLifeMs(0))
        expect(reflexLifeMs(0)).toBeGreaterThan(reflexLifeMs(40))
        expect(reflexLifeMs(1000)).toBe(420)
        expect(reflexPoints(100, 900)).toBe(2)
        expect(reflexPoints(500, 900)).toBe(1)
    })

    it('reflex is endless: hits go on with no clock, a light that goes out untouched ends it', () => {
        vi.useFakeTimers()
        try {
            const onFinish = vi.fn()
            render(<Provider store={makeStore()}><Reflex onFinish={onFinish} /></Provider>)
            fireEvent.click(screen.getByRole('button', { name: 'Los geht’s' }))
            for (let i = 0; i < 20; i++) {
                act(() => { vi.advanceTimersByTime(100) })
                fireEvent.pointerDown(screen.getByRole('button', { name: 'Licht, jetzt treffen' }))
            }
            expect(onFinish).not.toHaveBeenCalled()
            expect(screen.getByText('Treffer').nextSibling).toHaveTextContent('20')
            act(() => { vi.advanceTimersByTime(reflexLifeMs(20)) })
            expect(onFinish).toHaveBeenCalledWith(40)
            expect(screen.getByText('Ein Licht ist ausgegangen.')).toBeInTheDocument()
        } finally { vi.useRealTimers() }
    })

    it('reflex: a dark tile ends the run at once', () => {
        const onFinish = vi.fn()
        render(<Provider store={makeStore()}><Reflex onFinish={onFinish} /></Provider>)
        fireEvent.click(screen.getByRole('button', { name: 'Los geht’s' }))
        fireEvent.pointerDown(screen.getAllByRole('button', { name: 'Dunkles Feld' })[0])
        expect(onFinish).toHaveBeenCalledWith(0)
        expect(screen.getByText('Daneben getippt.')).toBeInTheDocument()
    })

    it('pattern: grows by one pad each round, gets faster', () => {
        const pattern = growPattern(growPattern([], () => 0), () => 0.99)
        expect(pattern).toEqual([0, 3])
        expect(patternStepMs(2)).toBeGreaterThan(patternStepMs(10))
    })

    it('every game has the same max as the server', () => {
        expect(Object.fromEntries(ARCADE_GAMES.map(g => [g.id, g.max]))).toEqual({ reflex: 10000, pattern: 200, guess: 500, scramble: 500, sequence: 500 })
    })
})

describe('the arcade page', () => {
    beforeEach(() => {
        apiFetch.mockReset()
        localStorage.clear()
    })

    function serve(extra = {}) {
        apiFetch.mockImplementation(async (url, options = {}) => {
            const key = `${options.method ?? 'GET'} ${url.split('?')[0]}`
            if (extra[key]) return extra[key](options, url)
            if (key === 'GET /api/arcade/me') return [{ game: 'pattern', level: 'normal', best: 7, rankedBest: null }]
            if (key === 'GET /api/arcade/leaderboard') return { top: [], me: null }
            return {}
        })
    }
    const renderPage = async () => {
        await act(async () => { render(<Provider store={makeStore()}><MemoryRouter><ArcadePage /></MemoryRouter></Provider>) })
    }

    it('starts in "just for me"; picking the leaderboard is remembered and says names are public', async () => {
        serve()
        await renderPage()
        expect(screen.getByRole('radio', { name: /Nur für mich/ })).toHaveAttribute('aria-checked', 'true')
        fireEvent.click(screen.getByRole('radio', { name: /Rangliste/ }))
        expect(localStorage.getItem('arcadeMode')).toBe('ranked')
        expect(screen.getByText(/sehen alle deinen Anzeigenamen/)).toBeInTheDocument()
    })

    it('shows my bests on the games and the leaderboard of the chosen game and difficulty', async () => {
        serve({
            'GET /api/arcade/leaderboard': (options, url) => (url.includes('game=guess&level=hard')
                ? { top: [{ rank: 1, user: { id: 2, username: 'bo', displayName: 'Bo' }, score: 9, me: false }], me: { rank: 4, score: 2 } }
                : { top: [], me: null }),
        })
        localStorage.setItem('funLevel:guess', 'hard')
        await renderPage()
        expect(await screen.findByText('Bestleistung 7')).toBeInTheDocument()
        await act(async () => { fireEvent.click(screen.getByRole('tab', { name: /Wortraten/ })) })
        const board = screen.getByRole('region', { name: 'Rangliste' })
        expect(await within(board).findByText('Bo')).toBeInTheDocument()
        expect(within(board).getByText('Du')).toBeInTheDocument()
        expect(within(board).getByText(/Schwer/)).toBeInTheDocument()
    })

    it('leaving every leaderboard asks the server and goes back to "just for me"', async () => {
        serve({
            'GET /api/arcade/leaderboard': () => ({ top: [{ rank: 1, user: { id: 1, username: 'ann', displayName: 'Ann' }, score: 30, me: true }], me: { rank: 1, score: 30 } }),
            'DELETE /api/arcade/ranked': () => ({ ranked: false }),
        })
        storeMode('ranked')
        await renderPage()
        await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Mich aus allen Ranglisten nehmen' })) })
        await waitFor(() => expect(sent('DELETE', '/api/arcade/ranked')).toHaveLength(1))
        expect(screen.getByRole('radio', { name: /Nur für mich/ })).toHaveAttribute('aria-checked', 'true')
    })
})
