import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { DAILY_LINES, LINE_TYPES, lineOfDay, dayNumber } from '../features/fun/dailyLines'
import { GUESS_WORDS, SCRAMBLE_WORDS } from '../features/fun/words'
import {
    makeRng, scoreGuess, keyStates, scramble, makeSequence, SEQUENCE_KIND_COUNT, readBest, saveBest,
    LEVELS, GUESS_LEVELS, scrambleWordsFor, sequenceKindsFor, sequenceIsTyped, readLevel, storeLevel,
} from '../features/fun/games'
import { fill } from '../features/helperFunction'
import translations from '../i18n/translations'
import Tutorial from '../components/Tutorial'
import Menu from '../components/menu'
import DailyTicker from '../components/DailyTicker'
import FunPage from '../components/fun/FunPage'

const makeStore = () => configureStore({ reducer: rootReducer })

beforeEach(() => {
    localStorage.clear()
})

describe('daily lines', () => {
    it('has a couple of hundred lines, each in both languages', () => {
        expect(DAILY_LINES.length).toBeGreaterThanOrEqual(200)
        for (const line of DAILY_LINES) {
            expect(LINE_TYPES).toContain(line.type)
            expect(line.en.trim()).not.toBe('')
            expect(line.de.trim()).not.toBe('')
        }
    })

    it('has no duplicates', () => {
        expect(new Set(DAILY_LINES.map((l) => l.en)).size).toBe(DAILY_LINES.length)
        expect(new Set(DAILY_LINES.map((l) => l.de)).size).toBe(DAILY_LINES.length)
    })

    it('stays the same all day and changes the next day', () => {
        const morning = new Date(2026, 9, 19, 0, 5)
        const evening = new Date(2026, 9, 19, 23, 55)
        const tomorrow = new Date(2026, 9, 20, 8, 0)
        expect(lineOfDay(morning)).toBe(lineOfDay(evening))
        expect(lineOfDay(tomorrow)).not.toBe(lineOfDay(morning))
    })

    it('shows every line once before any repeats', () => {
        const start = dayNumber(new Date(2026, 0, 1))
        const seen = new Set()
        for (let d = 0; d < DAILY_LINES.length; d++) {
            seen.add(lineOfDay(new Date(Date.UTC(1970, 0, 1) + (start + d) * 86400000 + 12 * 3600000)))
        }
        expect(seen.size).toBe(DAILY_LINES.length)
    })
})

describe('word lists', () => {
    it('every difficulty has plenty of guess words of its length, without duplicates', () => {
        for (const byLength of Object.values(GUESS_WORDS)) {
            for (const { length } of Object.values(GUESS_LEVELS)) {
                const list = byLength[length]
                expect(list.length).toBeGreaterThanOrEqual(40)
                for (const word of list) expect(word).toMatch(new RegExp(`^[A-Z]{${length}}$`))
                expect(new Set(list).size).toBe(list.length)
            }
        }
    })

    it('scramble words are plain letters with a hint, and every difficulty has enough of them', () => {
        for (const list of Object.values(SCRAMBLE_WORDS)) {
            for (const [word, hint] of list) {
                expect(word).toMatch(/^[A-Z]{4,13}$/)
                expect(hint).toBeTruthy()
            }
            for (const level of LEVELS) expect(scrambleWordsFor(list, level).length, level).toBeGreaterThanOrEqual(20)
        }
    })
})

describe('scoreGuess', () => {
    it('marks right spot, wrong spot and missing letters', () => {
        expect(scoreGuess('CRANE', 'CLOCK')).toEqual(['correct', 'absent', 'absent', 'absent', 'absent'])
        // only one T in the answer: the second T is grey
        expect(scoreGuess('TOAST', 'STORM')).toEqual(['present', 'present', 'absent', 'present', 'absent'])
    })

    it('counts repeated letters only as often as they appear', () => {
        // one E in the answer: only the first wrong-spot E counts
        expect(scoreGuess('EERIE', 'HONEY')).toEqual(['present', 'absent', 'absent', 'absent', 'absent'])
        // the E in the right spot wins over an earlier one elsewhere
        expect(scoreGuess('EXTRE', 'HOUSE')).toEqual(['absent', 'absent', 'absent', 'absent', 'correct'])
    })

    it('keyboard keeps the best result per letter', () => {
        expect(keyStates(['TOAST', 'STORM'], 'STORM')).toMatchObject({ S: 'correct', T: 'correct', O: 'correct', A: 'absent' })
    })
})

describe('scramble', () => {
    it('keeps the letters but never returns the word itself', () => {
        const rng = makeRng(1)
        for (let i = 0; i < 50; i++) {
            const mixed = scramble('PLANET', rng)
            expect(mixed).not.toBe('PLANET')
            expect([...mixed].sort()).toEqual([...'PLANET'].sort())
        }
    })
})

describe('number sequences', () => {
    it('every kind builds a puzzle with four distinct choices including the answer', () => {
        const rng = makeRng(42)
        for (let kind = 0; kind < SEQUENCE_KIND_COUNT; kind++) {
            for (let i = 0; i < 30; i++) {
                const p = makeSequence(rng, kind)
                expect(p.shown).toHaveLength(5)
                expect(p.choices).toHaveLength(4)
                expect(new Set(p.choices).size).toBe(4)
                expect(p.choices).toContain(p.answer)
                expect(p.choices.every((n) => Number.isInteger(n) && n > 0)).toBe(true)
            }
        }
    })

    it('every rule has a text with all its placeholders filled, in both languages', () => {
        const rng = makeRng(7)
        for (let kind = 0; kind < SEQUENCE_KIND_COUNT; kind++) {
            const [key, values] = makeSequence(rng, kind).rule
            for (const lang of ['de', 'en']) {
                expect(translations[lang][key], key).toBeTruthy()
                expect(fill(translations[lang][key], values)).not.toMatch(/\{\w+\}/)
            }
        }
    })

    it('arithmetic sequences continue with the same step', () => {
        const p = makeSequence(makeRng(3), 0)
        const step = p.shown[1] - p.shown[0]
        expect(p.answer).toBe(p.shown[4] + step)
    })

    it('harder levels draw from more kinds; only hard is typed in', () => {
        const easy = sequenceKindsFor('easy'), normal = sequenceKindsFor('normal'), hard = sequenceKindsFor('hard')
        expect(easy.length).toBeLessThan(normal.length)
        expect(normal.length).toBeLessThan(hard.length)
        expect(hard).toHaveLength(SEQUENCE_KIND_COUNT)
        expect(normal).toEqual(expect.arrayContaining(easy))
        expect(sequenceIsTyped('hard')).toBe(true)
        expect(sequenceIsTyped('normal')).toBe(false)
    })
})

describe('best scores and difficulty', () => {
    it('bests only go up and are kept per difficulty', () => {
        expect(readBest('guess', 'normal')).toBe(0)
        expect(saveBest('guess', 'normal', 3)).toBe(3)
        expect(saveBest('guess', 'normal', 1)).toBe(3)
        expect(readBest('guess', 'normal')).toBe(3)
        expect(readBest('guess', 'hard')).toBe(0)
    })

    it('the chosen difficulty is remembered, normal by default', () => {
        expect(readLevel('scramble')).toBe('normal')
        storeLevel('scramble', 'hard')
        expect(readLevel('scramble')).toBe('hard')
        localStorage.setItem('funLevel:scramble', 'impossible')
        expect(readLevel('scramble')).toBe('normal')
    })
})

describe('tutorial', () => {
    const renderTutorial = (store) => render(
        <Provider store={store}>
            <MemoryRouter>
                <Menu />
                <Tutorial />
            </MemoryRouter>
        </Provider>
    )

    it('opens by itself for a user who has not seen it, and only once', () => {
        const store = makeStore()
        store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 't', username: 'ann' } })
        const { unmount } = renderTutorial(store)

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Willkommen bei Quidey!' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Überspringen' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        unmount()

        // next visit: stays closed
        renderTutorial(store)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('a different account on the same device still gets it', () => {
        localStorage.setItem('tutorialSeen:ann', '1')
        const store = makeStore()
        store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 't', username: 'bob' } })
        renderTutorial(store)
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('walks through the steps and can be reopened from the menu', () => {
        localStorage.setItem('tutorialSeen:ann', '1')
        const store = makeStore()
        store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 't', username: 'ann' } })
        renderTutorial(store)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Einführung' }))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Zurück' })).toBeDisabled()

        fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
        expect(screen.getByRole('heading', { name: 'Sammle deine Aufgaben' })).toBeInTheDocument()

        // jump to the last step with the dots, then finish
        const dots = screen.getAllByRole('tab')
        fireEvent.click(dots.at(-1))
        fireEvent.click(screen.getByRole('button', { name: "Los geht's" }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(store.getState().settings.showTutorial).toBe(false)
    })

    it('closes with Escape', () => {
        const store = makeStore()
        store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 't', username: 'ann' } })
        renderTutorial(store)
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(localStorage.getItem('tutorialSeen:ann')).toBe('1')
    })
})

describe('fun page', () => {
    const renderAt = (entry) => render(
        <Provider store={makeStore()}>
            <MemoryRouter initialEntries={[entry]}>
                <DailyTicker />
                <Routes>
                    <Route path="/" element={<p>home page</p>} />
                    <Route path="/fun" element={<FunPage />} />
                </Routes>
            </MemoryRouter>
        </Provider>
    )

    it('typed in directly, it sends you home', () => {
        renderAt('/fun')
        expect(screen.getByText('home page')).toBeInTheDocument()
    })

    it('opens through the daily line', () => {
        renderAt('/')
        const label = translations.de[`lineOf_${lineOfDay().type}`]
        // hidden behind the bulb until it is tapped
        expect(screen.queryByRole('link', { name: new RegExp(`^${label}`) })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: label }))
        fireEvent.click(screen.getByRole('link', { name: new RegExp(`^${label}`) }))
        expect(screen.getByRole('heading', { name: 'Quidey-Spielwiese' })).toBeInTheDocument()
    })

    it('plays a round of word guess with the keyboard', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0) // first word of the list: APFEL
        renderAt({ pathname: '/fun', state: { fromTicker: true } })

        for (const key of 'APF') fireEvent.keyDown(window, { key })
        fireEvent.keyDown(window, { key: 'Enter' })
        expect(screen.getByText('Bitte 5 Buchstaben.')).toBeInTheDocument()

        for (const key of 'EL') fireEvent.keyDown(window, { key })
        fireEvent.keyDown(window, { key: 'Enter' })
        expect(screen.getByText('Genial!')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Neues Wort' })).toBeInTheDocument()
        expect(readBest('guess', 'normal')).toBe(1)
        vi.restoreAllMocks()
    })

    it('the difficulty changes the game and is remembered', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0) // first four-letter word: BAUM
        renderAt({ pathname: '/fun', state: { fromTicker: true } })

        fireEvent.click(screen.getByRole('button', { name: 'Leicht' }))
        expect(screen.getByRole('button', { name: 'Leicht' })).toHaveAttribute('aria-pressed', 'true')
        expect(localStorage.getItem('funLevel:guess')).toBe('easy')
        // seven rows of four tiles
        expect(screen.getAllByRole('row')).toHaveLength(7)
        expect(screen.getAllByRole('row')[0].children).toHaveLength(4)

        for (const key of 'BAUM') fireEvent.keyDown(window, { key })
        fireEvent.keyDown(window, { key: 'Enter' })
        expect(screen.getByText('Genial!')).toBeInTheDocument()
        expect(readBest('guess', 'easy')).toBe(1)
        vi.restoreAllMocks()
    })

    it('marks letters green, yellow and grey', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0) // APFEL
        renderAt({ pathname: '/fun', state: { fromTicker: true } })
        // A right spot, L elsewhere, X/Y/Z not in the word
        for (const key of 'ALXYZ') fireEvent.keyDown(window, { key })
        fireEvent.keyDown(window, { key: 'Enter' })
        const cells = screen.getAllByRole('gridcell').slice(0, 5).map((c) => c.getAttribute('aria-label'))
        expect(cells).toEqual(['A richtig', 'L woanders im Wort', 'X nicht im Wort', 'Y nicht im Wort', 'Z nicht im Wort'])
        vi.restoreAllMocks()
    })

    it('hard number sequences are typed in', () => {
        localStorage.setItem('funLevel:sequence', 'hard')
        renderAt({ pathname: '/fun', state: { fromTicker: true } })
        fireEvent.click(screen.getByRole('tab', { name: /Was kommt danach\?/ }))
        const input = screen.getByRole('spinbutton', { name: 'Deine Antwort' })
        fireEvent.change(input, { target: { value: '1' } })
        fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }))
        expect(screen.getByRole('button', { name: 'Nächstes Rätsel' })).toBeInTheDocument()
    })

    it('switches games', () => {
        renderAt({ pathname: '/fun', state: { fromTicker: true } })
        fireEvent.click(screen.getByRole('tab', { name: /Was kommt danach\?/ }))
        expect(screen.getByText('Welche Zahl kommt als Nächstes?')).toBeInTheDocument()

        // any answer shows the rule behind the numbers
        fireEvent.click(screen.getAllByRole('button').find((b) => /^\d[\d.]*$/.test(b.textContent)))
        expect(screen.getByRole('button', { name: 'Nächstes Rätsel' })).toBeInTheDocument()
    })
})
