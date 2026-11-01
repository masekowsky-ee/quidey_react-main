import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS } from '../features/auth/authActionTypes'
import { PRICES, YEARLY_PER_MONTH, YEARLY_SAVES, YEARLY_SAVES_PERCENT, LIMIT_EVENT } from '../features/pro/pro'
import ProPage from '../components/pro/ProPage'
import LimitDialog from '../components/pro/LimitDialog'
import CancelForm from '../legal/CancelForm'
import Stats from '../components/Stats'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const BILLING = { active: false, gift: false, until: null, subscription: null, canManageStripe: false, stripe: true, play: false, prices: { currency: 'EUR', monthly: 2.99, yearly: 25 }, playAccountId: 'a'.repeat(64) }

function Where() {
    const location = useLocation()
    return <span data-testid="where">{location.pathname}</span>
}

function renderWith(ui, { path = '/', access = {} } = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, accessMode: 'beta', ...access } })
    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[path]}>
                <Routes><Route path="*" element={<>{ui}<Where /></>} /></Routes>
            </MemoryRouter>
        </Provider>
    )
    return store
}

beforeEach(() => {
    apiFetch.mockReset()
    localStorage.clear()
})

describe('Quidey Pro: prices', () => {
    it('the year saves 30 %: 10,88 € less than twelve months at 2,99 €', () => {
        expect(PRICES).toEqual({ monthly: 2.99, yearly: 25 })
        expect(YEARLY_SAVES).toBe(10.88)
        expect(YEARLY_SAVES_PERCENT).toBe(30)
        expect(YEARLY_PER_MONTH).toBe(2.08)
    })
})

describe('Quidey Pro: the page', () => {
    it('says first why Pro exists, kindly, then offers the year (preselected) with its saving', async () => {
        apiFetch.mockImplementation(async (url) => (url === '/api/billing' ? BILLING : {}))
        await act(async () => { renderWith(<ProPage />, { path: '/pro' }) })
        expect(screen.getByRole('heading', { level: 1, name: 'Quidey unterstützen' })).toBeInTheDocument()
        expect(screen.getByText(/Quidey Pro gibt es aus genau einem Grund/)).toBeInTheDocument()
        expect(screen.getByText(/du bist hier genauso willkommen/)).toBeInTheDocument()
        expect(screen.getByText('Spare 30 %')).toBeInTheDocument()
        expect(screen.getByText(/10,88 € weniger als zwölf Monate einzeln/)).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: /Jährlich/ })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByText(/§ 19 UStG/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Verträge hier kündigen' })).toHaveAttribute('href', '/kuendigen')
    })

    it('goes to Stripe for the chosen plan', async () => {
        const assign = vi.fn()
        Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } })
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/billing') return BILLING
            if (url === '/api/billing/checkout') return { url: 'https://checkout.stripe.com/c/pay/x' }
            return {}
        })
        await act(async () => { renderWith(<ProPage />, { path: '/pro' }) })
        fireEvent.click(screen.getByRole('radio', { name: /Monatlich/ }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Weiter zur Bezahlung/ })) })
        const [, options] = apiFetch.mock.calls.find(([url]) => url === '/api/billing/checkout')
        expect(JSON.parse(options.body)).toEqual({ plan: 'monthly', language: 'de' })
        expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/x')
    })

    it('thanks a supporter and shows when the subscription renews', async () => {
        const active = { ...BILLING, active: true, canManageStripe: true, subscription: { provider: 'stripe', plan: 'yearly', status: 'active', periodEnd: '2027-11-01T10:00:00Z', cancelAtPeriodEnd: false } }
        apiFetch.mockImplementation(async (url) => (url === '/api/billing' ? active : {}))
        await act(async () => { renderWith(<ProPage />, { path: '/pro', access: { pro: { active: true } } }) })
        expect(screen.getByText('Danke, dass du Quidey unterstützt!')).toBeInTheDocument()
        expect(screen.getByText('Verlängert sich am')).toBeInTheDocument()
        expect(screen.getByText('1.11.2027')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Abo verwalten' })).toBeInTheDocument()
    })
})

describe('the free plan is full', () => {
    it('apiFetch announces LIMIT_REACHED; the dialog says it kindly and leads to Pro', async () => {
        const { apiFetch: realFetch } = await vi.importActual('../features/helperFunction')
        globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'x', code: 'LIMIT_REACHED', limit: 'tasks', max: 10 }), { status: 403 }))
        apiFetch.mockImplementation(async () => ({}))
        renderWith(<LimitDialog />)
        await act(async () => { await realFetch('/api/tasks', { method: 'POST', body: '{}' }).catch((err) => expect(err.limit).toBe('tasks')) })
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
        expect(screen.getByText(/Platz für 10 offene Aufgaben/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Quidey Pro ansehen/ }))
        expect(screen.getByTestId('where')).toHaveTextContent('/pro')
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('closes with "later"', async () => {
        apiFetch.mockImplementation(async () => ({}))
        renderWith(<LimitDialog />)
        act(() => { window.dispatchEvent(new CustomEvent(LIMIT_EVENT, { detail: { limit: 'friends', max: 3 } })) })
        expect(screen.getByText(/3 Freunde/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Vielleicht später' }))
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('statistics show this week only, the longer periods point to Pro', async () => {
        const empty = { focus: { days: [], ms: 0, sessions: 0 }, events: { days: [], ms: 0, types: [] }, groups: [], tasksDone: 0 }
        apiFetch.mockImplementation(async (url) => (url.startsWith('/api/stats') ? empty : {}))
        await act(async () => {
            renderWith(<Stats />, { path: '/stats?range=year', access: { accessMode: 'open', limits: { tasks: 10, statsDays: 7 }, usage: { tasks: 3 } } })
        })
        expect(screen.getByRole('radio', { name: 'Woche' })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByRole('radio', { name: 'Jahr' })).toBeDisabled()
        expect(screen.getByRole('link', { name: 'Mehr mit Quidey Pro' })).toHaveAttribute('href', '/pro')
        expect(apiFetch.mock.calls.some(([url]) => url.startsWith('/api/stats?from='))).toBe(true)
    })
})

describe('Verträge hier kündigen', () => {
    it('asks what § 312k BGB asks for, ends with "Jetzt kündigen" and confirms with the time', async () => {
        apiFetch.mockResolvedValue({ received: true, receivedAt: '2026-11-01T13:05:00Z' })
        renderWith(<CancelForm />)
        expect(screen.getByLabelText(/Ordentliche Kündigung/)).toBeChecked()
        fireEvent.change(screen.getByLabelText('Vor- und Nachname'), { target: { value: 'Ann Example' } })
        fireEvent.change(screen.getByLabelText(/E-Mail-Adresse deines Quidey-Kontos/), { target: { value: 'ann@example.com' } })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Jetzt kündigen' })) })
        const [url, options] = apiFetch.mock.calls[0]
        expect(url).toBe('/api/billing/cancel')
        expect(JSON.parse(options.body)).toMatchObject({ name: 'Ann Example', email: 'ann@example.com', reason: 'ordinary' })
        await waitFor(() => expect(screen.getByText('Deine Kündigung ist eingegangen')).toBeInTheDocument())
    })

    it('an extraordinary cancellation asks for the reason', () => {
        renderWith(<CancelForm />)
        fireEvent.click(screen.getByLabelText(/Außerordentliche Kündigung/))
        expect(screen.getByLabelText('Wichtiger Grund')).toBeRequired()
    })
})
