import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import settingsReducer from '../features/settings/settingsReducer'
import { setLanguage, setAccent, setDefaultSessionMinutes } from '../features/settings/settingsAction'
import { setTimer } from '../features/session/sessionAction'
import { readStoredLanguage, readStoredAccent, readStoredSessionMinutes } from '../features/settings/preferences'
import { useApplyTheme } from '../features/settings/theme'
import Settings from '../components/Settings'
import Logo from '../components/Logo'

const makeStore = () => configureStore({ reducer: rootReducer })
const initial = settingsReducer(undefined, { type: '@@INIT' })

beforeEach(() => {
    localStorage.clear()
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})

describe('stored preferences', () => {
    it('fall back to German, Abendrot (sunset) and 30 minutes', () => {
        expect(readStoredLanguage()).toBe('de')
        expect(readStoredAccent()).toBe('sunset')
        expect(readStoredSessionMinutes()).toBe(30)
    })

    it('read valid saved values', () => {
        localStorage.setItem('language', 'en')
        localStorage.setItem('accent', 'ocean')
        localStorage.setItem('sessionMinutes', '45')
        expect(readStoredLanguage()).toBe('en')
        expect(readStoredAccent()).toBe('ocean')
        expect(readStoredSessionMinutes()).toBe(45)
    })

    it('ignore invalid saved values', () => {
        localStorage.setItem('language', 'fr')
        localStorage.setItem('accent', 'neon')
        localStorage.setItem('sessionMinutes', '7')
        expect(readStoredLanguage()).toBe('de')
        expect(readStoredAccent()).toBe('sunset')
        expect(readStoredSessionMinutes()).toBe(30)
    })

    it('survive blocked storage', () => {
        const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
        expect(readStoredLanguage()).toBe('de')
        expect(readStoredAccent()).toBe('sunset')
        expect(readStoredSessionMinutes()).toBe(30)
        spy.mockRestore()
    })
})

describe('setting actions remember the choice', () => {
    it('language', () => {
        const state = settingsReducer(initial, setLanguage('en'))
        expect(state.language).toBe('en')
        expect(localStorage.getItem('language')).toBe('en')
    })

    it('accent color', () => {
        const state = settingsReducer(initial, setAccent('violet'))
        expect(state.accent).toBe('violet')
        expect(localStorage.getItem('accent')).toBe('violet')
    })

    it('default session length', () => {
        const state = settingsReducer(initial, setDefaultSessionMinutes(25))
        expect(state.defaultSessionMinutes).toBe(25)
        expect(localStorage.getItem('sessionMinutes')).toBe('25')
    })

    it('invalid values change and store nothing', () => {
        expect(settingsReducer(initial, setLanguage('fr'))).toBe(initial)
        expect(settingsReducer(initial, setAccent('neon'))).toBe(initial)
        expect(settingsReducer(initial, setDefaultSessionMinutes(7))).toBe(initial)
        expect(localStorage.length).toBe(0)
    })
})

describe('accent on <html>', () => {
    it('follows the setting', () => {
        const store = makeStore()
        renderHook(() => useApplyTheme(), { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> })
        // Abendrot (sunset) unless another one was chosen
        expect(document.documentElement.dataset.accent).toBe('sunset')

        store.dispatch(setAccent('green'))
        // effects run synchronously inside act via renderHook's rerender
        renderHook(() => useApplyTheme(), { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> })
        expect(document.documentElement.dataset.accent).toBe('green')
    })
})

describe('logo in the accent color', () => {
    it('the tab icon follows the setting', () => {
        const link = document.createElement('link')
        link.rel = 'icon'
        link.href = '/quidey-logo.svg'
        document.head.appendChild(link)
        const store = makeStore()
        const { rerender } = renderHook(() => useApplyTheme(), { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> })
        expect(decodeURIComponent(link.href)).toContain('stroke="#fb923c"')

        act(() => { store.dispatch(setAccent('ocean')) })
        rerender()
        expect(decodeURIComponent(link.href)).toContain('stroke="#38bdf8"')
        link.remove()
    })

    it('the logo is drawn in the accent color', () => {
        const { container } = render(<Logo />)
        const strokes = [...container.querySelectorAll('circle, path[stroke-linejoin]')].map(el => el.style.stroke)
        expect(strokes).toEqual(['var(--primary, #fb923c)', 'var(--primary, #fb923c)'])
    })
})

describe('Settings page', () => {
    const renderSettings = () => {
        const store = makeStore()
        render(<Provider store={store}><Settings /></Provider>)
        return store
    }

    it('picks an accent color', () => {
        const store = renderSettings()
        expect(screen.getByRole('button', { name: 'Abendrot' })).toHaveAttribute('aria-pressed', 'true')

        fireEvent.click(screen.getByRole('button', { name: 'Ozean' }))

        expect(store.getState().settings.accent).toBe('ocean')
        expect(screen.getByRole('button', { name: 'Ozean' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('a new session length applies to the idle timer right away', () => {
        const store = renderSettings()

        fireEvent.click(screen.getByRole('button', { name: '45' }))

        expect(store.getState().settings.defaultSessionMinutes).toBe(45)
        expect(store.getState().session.timer).toEqual({ time: 45 * 60 * 1000, active: false })
    })

    it('does not touch a running timer', () => {
        const store = renderSettings()
        store.dispatch(setTimer(10 * 60 * 1000, true))

        fireEvent.click(screen.getByRole('button', { name: '15' }))

        expect(store.getState().settings.defaultSessionMinutes).toBe(15)
        expect(store.getState().session.timer).toEqual({ time: 10 * 60 * 1000, active: true })
    })

    it('switches the language and the page follows', () => {
        renderSettings()
        fireEvent.click(screen.getByRole('button', { name: 'Englisch' }))
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    })
})
