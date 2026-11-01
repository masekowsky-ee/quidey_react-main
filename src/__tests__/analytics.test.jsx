import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'

// the app's plugin (android/…/AnalyticsPlugin.java), as the Android app would answer
const plugin = vi.hoisted(() => ({
    isAvailable: vi.fn(async () => ({ available: true })),
    setEnabled: vi.fn(async () => {}),
    logScreen: vi.fn(async () => {}),
    logEvent: vi.fn(async () => {}),
}))
const native = vi.hoisted(() => ({ app: false }))

vi.mock('@capacitor/core', async (importOriginal) => {
    const original = await importOriginal()
    return { ...original, registerPlugin: (name) => (name === 'QuideyAnalytics' ? plugin : original.registerPlugin(name)) }
})
vi.mock('../features/native/native', async (importOriginal) => ({
    ...(await importOriginal()),
    isNativeApp: () => native.app,
}))

const { setupAnalytics, setAnalyticsConsent, trackScreen, trackEvent, screenName, analyticsQuestionDue, resetAnalytics } = await import('../features/native/analytics')
const { noteAction } = await import('../features/onboarding/onboarding')
const { default: OnboardingPrompts, ANALYTICS_DELAY_MS } = await import('../components/onboarding/OnboardingPrompts')
const { default: Settings } = await import('../components/Settings')

const renderWithStore = (ui) => render(
    <Provider store={configureStore({ reducer: rootReducer })}><MemoryRouter>{ui}</MemoryRouter></Provider>
)

beforeEach(() => {
    localStorage.clear()
    Object.values(plugin).forEach((fn) => fn.mockClear())
    plugin.isAvailable.mockImplementation(async () => ({ available: true }))
    native.app = false
    resetAnalytics()
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => vi.unstubAllEnvs())

const inTheApp = async (answer) => {
    native.app = true
    vi.stubEnv('VITE_NATIVE_ANALYTICS', 'on')
    if (answer) localStorage.setItem('analytics', answer)
    resetAnalytics()
    await setupAnalytics()
}

describe('Google Analytics for Firebase (Android app, with consent only)', () => {
    it('names pages without ids or user names', () => {
        expect(screenName('/')).toBe('home')
        expect(screenName('/u/anna')).toBe('user_profile')
        expect(screenName('/together/42')).toBe('session')
        expect(screenName('/family/7')).toBe('family')
        expect(screenName('/routines/3/run')).toBe('routine_run')
        expect(screenName('/community/friends')).toBe('community_friends')
        expect(screenName('/community/whatever')).toBe('community')
        expect(screenName('/calendar')).toBe('calendar')
        expect(screenName('/something-new/123')).toBe('other')
    })

    it('does nothing in the browser', async () => {
        await setupAnalytics()
        expect(plugin.isAvailable).not.toHaveBeenCalled()
        expect(analyticsQuestionDue()).toBe(false)
        localStorage.setItem('analytics', 'granted')
        trackScreen('/calendar')
        expect(plugin.logScreen).not.toHaveBeenCalled()
    })

    it('does nothing in an app built without Firebase', async () => {
        native.app = true
        await setupAnalytics()
        expect(plugin.isAvailable).not.toHaveBeenCalled()
        expect(analyticsQuestionDue()).toBe(false)
    })

    it('keeps collection off and counts nothing until there is a yes', async () => {
        await inTheApp()
        expect(plugin.setEnabled).toHaveBeenCalledWith({ enabled: false })
        expect(analyticsQuestionDue()).toBe(true)
        trackScreen('/calendar')
        trackEvent('task_created')
        expect(plugin.logScreen).not.toHaveBeenCalled()
        expect(plugin.logEvent).not.toHaveBeenCalled()
    })

    it('after a yes counts pages by name and actions by kind; a no stops it again', async () => {
        await inTheApp()
        await setAnalyticsConsent(true)
        expect(localStorage.getItem('analytics')).toBe('granted')
        expect(plugin.setEnabled).toHaveBeenLastCalledWith({ enabled: true })
        trackScreen('/u/anna')
        expect(plugin.logScreen).toHaveBeenCalledWith({ name: 'user_profile' })
        noteAction('done')
        expect(plugin.logEvent).toHaveBeenCalledWith({ name: 'task_done', params: {} })

        await setAnalyticsConsent(false)
        expect(plugin.setEnabled).toHaveBeenLastCalledWith({ enabled: false })
        plugin.logScreen.mockClear()
        trackScreen('/calendar')
        expect(plugin.logScreen).not.toHaveBeenCalled()
    })

    it('hands a remembered yes to Android again on every start', async () => {
        await inTheApp('granted')
        expect(plugin.setEnabled).toHaveBeenCalledWith({ enabled: true })
        expect(analyticsQuestionDue()).toBe(false)
    })

    it('asks once, with two answers that weigh the same', async () => {
        await inTheApp()
        renderWithStore(<OnboardingPrompts />)
        const dialog = await screen.findByRole('dialog', { name: 'Hilfst du mit, Quidey besser zu machen?' }, { timeout: ANALYTICS_DELAY_MS + 1500 })
        const yes = screen.getByRole('button', { name: 'Ja, mitzählen' })
        const no = screen.getByRole('button', { name: 'Nein, nicht mitzählen' })
        expect(yes.className).toBe(no.className)
        expect(dialog).toHaveTextContent('Ohne dein Ja wird nichts erfasst.')
        await act(async () => { fireEvent.click(no) })
        expect(localStorage.getItem('analytics')).toBe('denied')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('closed without an answer, it is asked again on the next start (and nothing is counted)', async () => {
        await inTheApp()
        renderWithStore(<OnboardingPrompts />)
        await screen.findByRole('dialog', {}, { timeout: ANALYTICS_DELAY_MS + 1500 })
        await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
        expect(localStorage.getItem('analytics')).toBe(null)
        expect(analyticsQuestionDue()).toBe(false)
        await inTheApp()
        expect(analyticsQuestionDue()).toBe(true)
    })

    it('can be changed in Settings → App → Nutzungsdaten', async () => {
        await inTheApp('granted')
        renderWithStore(<Settings />)
        fireEvent.click(screen.getByRole('tab', { name: 'App' }))
        expect(screen.getByRole('heading', { name: 'Nutzungsdaten' })).toBeInTheDocument()
        const group = screen.getByRole('group', { name: 'Nutzung mitzählen' })
        await act(async () => { fireEvent.click(within(group).getByRole('button', { name: 'Aus' })) })
        expect(localStorage.getItem('analytics')).toBe('denied')
        expect(plugin.setEnabled).toHaveBeenLastCalledWith({ enabled: false })
    })

    it('has no settings row in the browser', () => {
        renderWithStore(<Settings />)
        fireEvent.click(screen.getByRole('tab', { name: 'App' }))
        expect(screen.queryByRole('heading', { name: 'Nutzungsdaten' })).not.toBeInTheDocument()
    })
})
