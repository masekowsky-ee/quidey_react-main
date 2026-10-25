import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_TASK_STATE } from '../features/tasks/taskActionTypes'
import { PUBLIC_FILES } from '../../pwa.js'
import TaskContainer from '../components/TaskContainer'
import AppSkeleton from '../components/skeleton/AppSkeleton'
import { GateSkeleton, RouteSkeleton } from '../components/skeleton/PageSkeletons'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const makeStore = () => configureStore({ reducer: rootReducer })
const renderAt = (store, ui, path = '/') => render(<Provider store={store}><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></Provider>)

beforeEach(() => {
    localStorage.clear()
    apiFetch.mockReset()
    apiFetch.mockResolvedValue([])
})
afterEach(() => {
    vi.useRealTimers()
})

describe('the first paint (index.html, public/boot.css)', () => {
    const html = readFileSync('index.html', 'utf8')
    const boot = readFileSync('public/boot.css', 'utf8')
    const app = readFileSync('src/index.css', 'utf8')

    // { selector: { name: value } } of the custom properties set in a stylesheet
    const variables = (css, names) => {
        const found = {}
        for (const [, selector, body] of css.matchAll(/(:root(?:\[[^\]]+\])*)\s*\{([^}]*)\}/g)) {
            for (const [, name, value] of body.matchAll(/--(?:boot-)?([a-z-]+):\s*([^;]+);/g)) {
                if (names.includes(name)) (found[selector] ??= {})[name] = value.trim()
            }
        }
        return found
    }

    it('paints the same ground as the app in every theme and palette, not a white page', () => {
        const names = ['bg', 'surface', 'surface-strong', 'border']
        const bootColors = variables(boot, names)
        const appColors = variables(app, names)
        // dark and light, the default ground and five palettes
        expect(Object.keys(bootColors)).toHaveLength(12)
        for (const [selector, values] of Object.entries(bootColors)) {
            expect({ selector, ...values }).toEqual({ selector, ...appColors[selector] })
        }
    })

    it('carries a skeleton in #root without style attributes (the CSP forbids them)', () => {
        expect(html).toMatch(/<div id="root">\s*<!--[^>]*-->\s*<div class="boot"/)
        expect(html).not.toMatch(/\sstyle="/)
        // after theme-init.js (which picks the skeleton), before the app
        expect(html.indexOf('/theme-init.js')).toBeLessThan(html.indexOf('/boot.css'))
        expect(html.indexOf('/boot.css')).toBeLessThan(html.indexOf('/src/main.jsx'))
        expect(PUBLIC_FILES).toContain('/boot.css')
    })

    it('theme-init.js picks the skeleton: sign-in, Home or another page', () => {
        const source = readFileSync('public/theme-init.js', 'utf8')
        const matchMedia = window.matchMedia
        window.matchMedia = () => ({ matches: false })
        const run = (path, token) => {
            window.history.replaceState(null, '', path)
            if (token) localStorage.setItem('token', token); else localStorage.removeItem('token')
            new Function(source)()
            return document.documentElement.dataset.boot
        }
        expect(run('/', null)).toBe('gate')
        expect(run('/', 'jwt')).toBe('home')
        expect(run('/calendar', 'jwt')).toBe('page')
        window.history.replaceState(null, '', '/')
        window.matchMedia = matchMedia
    })
})

describe('Home while my tasks are on their way', () => {
    it('shows rows of shapes instead of "nothing open", then the list', () => {
        const store = makeStore()
        renderAt(store, <TaskContainer setCreateTask={() => {}} />)
        expect(screen.queryByText('Keine offenen Aufgaben')).not.toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Lädt…')

        act(() => { store.dispatch({ type: SET_TASK_STATE, payload: { tasks: [], groups: [], notes: [] } }) })
        expect(screen.getByText('Keine offenen Aufgaben')).toBeInTheDocument()
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
})

describe('page skeletons', () => {
    it('draw the page that is coming, with its title and tabs, nothing to use yet', () => {
        renderAt(makeStore(), <RouteSkeleton pathname="/stats" />, '/stats?tab=done')
        expect(screen.getByRole('heading', { name: 'Statistiken' })).toBeInTheDocument()
        const done = screen.getByText('Erledigt')
        expect(done.className).toMatch(/tabActive/)
        expect(done.closest('[inert]')).not.toBeNull()
        // "Loading…" stays outside the inert part, where it is heard
        expect(screen.getByRole('status').closest('[inert]')).toBeNull()
    })

    it('the calendar shows this month with its days', () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(2026, 9, 25, 12))
        renderAt(makeStore(), <RouteSkeleton pathname="/calendar" />, '/calendar')
        expect(screen.getByRole('heading', { name: 'Oktober 2026' })).toBeInTheDocument()
        expect(screen.getByText('31')).toBeInTheDocument()
    })

    it('anything without its own skeleton gets a column of cards', () => {
        renderAt(makeStore(), <RouteSkeleton pathname="/feedback" />, '/feedback')
        expect(screen.getByRole('status')).toHaveTextContent('Lädt…')
    })

    it('the sign-in opens on the tab of its address', () => {
        renderAt(makeStore(), <GateSkeleton />, '/signup')
        expect(screen.getByText('Registrieren').className).toMatch(/tabActive/)
    })
})

describe('the start screen', () => {
    it('shows the app frame and Home, and after a while offers to try again', async () => {
        vi.useFakeTimers()
        const store = makeStore()
        renderAt(store, <AppSkeleton />)
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
        expect(screen.queryByText('Verbindung zum Server wird hergestellt…')).not.toBeInTheDocument()

        await act(async () => { vi.advanceTimersByTime(5000) })
        expect(screen.getByText('Verbindung zum Server wird hergestellt…')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeEnabled()
    })
})
