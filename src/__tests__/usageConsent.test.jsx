import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { SET_ACCESS } from '../features/auth/authActionTypes'

const { default: OnboardingPrompts, ANALYTICS_DELAY_MS } = await import('../components/onboarding/OnboardingPrompts')
const { resetUsageAskLater } = await import('../features/usage/askLater')
const { default: Settings } = await import('../components/Settings')

let fetchMock
let store
const putCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/profile/usage-consent'))

const setAccess = (patch) => act(() => {
    store.dispatch({ type: SET_ACCESS, payload: { ...store.getState().auth.access, ...patch } })
})

const renderApp = (ui) => render(<Provider store={store}><MemoryRouter>{ui}</MemoryRouter></Provider>)

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('token', 'tok')
    resetUsageAskLater()
    store = configureStore({ reducer: rootReducer })
    fetchMock = vi.fn(async (url, init) => {
        if (String(url).endsWith('/api/profile/usage-consent')) {
            const granted = JSON.parse(init.body).granted
            return { ok: true, status: 200, json: async () => ({ choice: granted ? 'granted' : 'denied', at: '2026-11-07T10:00:00.000Z', version: 1 }) }
        }
        return { ok: true, status: 204, json: async () => ({}) }
    })
    vi.stubGlobal('fetch', fetchMock)
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => vi.unstubAllGlobals())

const card = () => screen.findByRole('dialog', { name: 'Hilf mit, Quidey besser zu machen' }, { timeout: ANALYTICS_DELAY_MS + 1500 })

describe('usage consent card', () => {
    it('appears for an unanswered choice once access is checked, with two equal answers', async () => {
        await setAccess({ checked: true })
        renderApp(<OnboardingPrompts />)
        const dialog = await card()
        expect(dialog).toHaveTextContent('Nur Summen, ohne Konto und Inhalte.')
        expect(dialog).not.toHaveTextContent('Nie wer')
        const yes = screen.getByRole('button', { name: 'Ja, mitzählen' })
        const no = screen.getByRole('button', { name: 'Nein' })
        expect(document.activeElement).not.toBe(yes)
        expect(document.activeElement).not.toBe(no)
        expect(yes.className).toBe(no.className)
        await act(async () => { fireEvent.click(yes) })
        expect(JSON.parse(putCalls()[0][1].body)).toEqual({ granted: true })
        expect(store.getState().auth.access.usageConsent.choice).toBe('granted')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('"Nein" sends false', async () => {
        await setAccess({ checked: true })
        renderApp(<OnboardingPrompts />)
        await card()
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Nein' })) })
        expect(JSON.parse(putCalls()[0][1].body)).toEqual({ granted: false })
    })

    it('Escape closes it and sends nothing', async () => {
        await setAccess({ checked: true })
        renderApp(<OnboardingPrompts />)
        await card()
        await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(putCalls()).toHaveLength(0)
    })

    it('is not shown when answered, or before access is checked', async () => {
        await setAccess({ checked: true, usageConsent: { choice: 'denied', at: '2026-11-07T10:00:00.000Z', version: 1 } })
        renderApp(<OnboardingPrompts />)
        await new Promise((r) => setTimeout(r, ANALYTICS_DELAY_MS + 300))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('is not shown before /api/me answered', async () => {
        renderApp(<OnboardingPrompts />)
        await new Promise((r) => setTimeout(r, ANALYTICS_DELAY_MS + 300))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})

describe('Settings → Datenschutz', () => {
    const open = () => {
        renderApp(<Settings />)
    }

    it('shows "Noch nicht gefragt", then the date after switching on', async () => {
        await setAccess({ checked: true })
        open()
        expect(screen.getByRole('heading', { name: 'Datenschutz' })).toBeInTheDocument()
        expect(screen.getByText('Noch nicht gefragt')).toBeInTheDocument()
        const group = screen.getByRole('group', { name: 'Anonyme Nutzungsstatistik' })
        await act(async () => { fireEvent.click(within(group).getByRole('button', { name: 'An' })) })
        expect(JSON.parse(putCalls()[0][1].body)).toEqual({ granted: true })
        expect(screen.getByText(/Zugestimmt am 7\.11\.2026/)).toBeInTheDocument()
    })

    it('shows "Abgelehnt am" for a denied choice', async () => {
        await setAccess({ checked: true, usageConsent: { choice: 'denied', at: '2026-11-07T10:00:00.000Z', version: 1 } })
        open()
        expect(screen.getByText(/Abgelehnt am 7\.11\.2026/)).toBeInTheDocument()
    })

    it('links to the privacy policy section', async () => {
        await setAccess({ checked: true })
        open()
        expect(screen.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute('href', '/datenschutz#nutzungsstatistik')
    })

    it('a failed save leaves the choice and shows an error toast', async () => {
        await setAccess({ checked: true })
        fetchMock.mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({ error: 'x', code: 'SERVER' }) }))
        open()
        const group = screen.getByRole('group', { name: 'Anonyme Nutzungsstatistik' })
        await act(async () => { fireEvent.click(within(group).getByRole('button', { name: 'An' })) })
        expect(store.getState().auth.access.usageConsent.choice).toBe(null)
        expect(screen.getByText('Noch nicht gefragt')).toBeInTheDocument()
        expect(store.getState().toast.map((x) => x.tone)).toContain('error')
    })
})
