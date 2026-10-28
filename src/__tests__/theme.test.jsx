import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import settingsReducer from '../features/settings/settingsReducer'
import { setTheme } from '../features/settings/settingsAction'
import { resolveTheme, readStoredTheme, useApplyTheme } from '../features/settings/theme'
import Settings from '../components/Settings'

// jsdom has no matchMedia; this one can be switched between light and dark like an OS setting
function mockSystemTheme(prefersLight) {
    const listeners = new Set()
    const media = {
        matches: prefersLight,
        addEventListener: (_, fn) => listeners.add(fn),
        removeEventListener: (_, fn) => listeners.delete(fn),
    }
    window.matchMedia = vi.fn(() => media)
    return {
        listenerCount: () => listeners.size,
        change(nextPrefersLight) {
            media.matches = nextPrefersLight
            listeners.forEach(fn => fn())
        },
    }
}

const makeStore = () => configureStore({ reducer: rootReducer })
const wrapperFor = (store) => ({ children }) => <Provider store={store}>{children}</Provider>
const htmlTheme = () => document.documentElement.dataset.theme

beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
})

afterEach(() => {
    delete window.matchMedia
})

describe('resolveTheme', () => {
    it('uses dark and light as chosen', () => {
        expect(resolveTheme('dark', true)).toBe('dark')
        expect(resolveTheme('light', false)).toBe('light')
    })

    it('follows the operating system for "system"', () => {
        expect(resolveTheme('system', true)).toBe('light')
        expect(resolveTheme('system', false)).toBe('dark')
    })

    it('falls back to dark for anything unknown', () => {
        expect(resolveTheme('purple', true)).toBe('dark')
    })
})

describe('readStoredTheme', () => {
    it('follows the system when nothing is saved', () => {
        expect(readStoredTheme()).toBe('system')
    })

    it('returns a saved valid choice', () => {
        localStorage.setItem('theme', 'system')
        expect(readStoredTheme()).toBe('system')
    })

    it('ignores invalid saved values', () => {
        localStorage.setItem('theme', 'purple')
        expect(readStoredTheme()).toBe('system')
    })

    it('still works when localStorage throws (private mode, blocked storage)', () => {
        const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
        expect(readStoredTheme()).toBe('system')
        spy.mockRestore()
    })
})

describe('settingsReducer theme', () => {
    const initial = settingsReducer(undefined, { type: '@@INIT' })

    it('switches to a valid theme', () => {
        expect(settingsReducer(initial, setTheme('light')).theme).toBe('light')
    })

    it('ignores invalid values', () => {
        expect(settingsReducer(initial, setTheme('purple'))).toBe(initial)
    })
})

describe('useApplyTheme', () => {
    it('puts the chosen theme on <html> and saves it', () => {
        mockSystemTheme(false)
        const store = makeStore()
        renderHook(() => useApplyTheme(), { wrapper: wrapperFor(store) })
        expect(htmlTheme()).toBe('dark')

        act(() => { store.dispatch(setTheme('light')) })

        expect(htmlTheme()).toBe('light')
        expect(localStorage.getItem('theme')).toBe('light')
    })

    it('follows the operating system live while "system" is chosen', () => {
        const system = mockSystemTheme(false)
        const store = makeStore()
        store.dispatch(setTheme('system'))
        renderHook(() => useApplyTheme(), { wrapper: wrapperFor(store) })
        expect(htmlTheme()).toBe('dark')

        act(() => system.change(true))

        expect(htmlTheme()).toBe('light')
    })

    it('stops following the system after switching to a fixed theme', () => {
        const system = mockSystemTheme(false)
        const store = makeStore()
        store.dispatch(setTheme('system'))
        renderHook(() => useApplyTheme(), { wrapper: wrapperFor(store) })
        expect(system.listenerCount()).toBe(1)

        act(() => { store.dispatch(setTheme('dark')) })
        act(() => system.change(true))

        expect(system.listenerCount()).toBe(0)
        expect(htmlTheme()).toBe('dark')
    })
})

describe('Settings page', () => {
    it('shows the current theme and switches it', () => {
        mockSystemTheme(false)
        const store = makeStore()
        render(<Provider store={store}><MemoryRouter><Settings /></MemoryRouter></Provider>)

        // nothing chosen yet: the device's
        expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true')

        fireEvent.click(screen.getByRole('button', { name: 'Hell' }))

        expect(store.getState().settings.theme).toBe('light')
        expect(screen.getByRole('button', { name: 'Hell' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'false')
    })
})
