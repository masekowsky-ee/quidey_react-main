import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS, LOGIN_SUCCESS } from '../features/auth/authActionTypes'
import { MAX_PRICES } from '../features/pro/pro'
import { selectHasMax } from '../features/pro/pro'
import ProPage from '../components/pro/ProPage'
import Admin from '../components/Admin'

vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const BILLING = {
    active: false, gift: false, until: null, tier: null, maxUntil: null, subscription: null, canManageStripe: false,
    stripe: true, stripeMax: true, play: false, prices: { currency: 'EUR', monthly: 2.99, yearly: 25, max: { monthly: 5.99, yearly: 49 } }, playAccountId: 'a'.repeat(64),
}

function makeStore(access = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: LOGIN_SUCCESS, payload: { token: 'tok', username: 'me' } })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, accessMode: 'beta', ...access } })
    return store
}

function renderPro(store) {
    return render(
        <Provider store={store}>
            <MemoryRouter initialEntries={['/pro']}>
                <Routes><Route path="*" element={<ProPage />} /></Routes>
            </MemoryRouter>
        </Provider>
    )
}

beforeEach(() => {
    apiFetch.mockReset()
    localStorage.clear()
})

describe('Max: access state', () => {
    it('is inactive by default and selectHasMax follows access.max.active', () => {
        const store = makeStore()
        expect(store.getState().auth.access.max).toEqual({ active: false, gift: false, until: null })
        expect(selectHasMax(store.getState())).toBe(false)
        store.dispatch({ type: SET_ACCESS, payload: { isPro: true, max: { active: true, gift: false, until: '2027-01-01T00:00:00Z' } } })
        expect(selectHasMax(store.getState())).toBe(true)
    })

    it('has the Max prices', () => {
        expect(MAX_PRICES).toEqual({ monthly: 5.99, yearly: 49 })
    })
})

describe('Max: the plans page', () => {
    it('shows Pro and Max, each with monthly and yearly and their prices', async () => {
        apiFetch.mockImplementation(async (url) => (url === '/api/billing' ? BILLING : {}))
        await act(async () => { renderPro(makeStore()) })
        const pro = screen.getByRole('radiogroup', { name: 'Pro' })
        const max = screen.getByRole('radiogroup', { name: 'Max' })
        expect(within(pro).getByRole('radio', { name: /Monatlich/ })).toHaveTextContent('2,99')
        expect(within(pro).getByRole('radio', { name: /Jährlich/ })).toHaveTextContent('25')
        expect(within(max).getByRole('radio', { name: /Monatlich/ })).toHaveTextContent('5,99')
        expect(within(max).getByRole('radio', { name: /Jährlich/ })).toHaveTextContent('49')
    })

    it('choosing Max yearly posts { tier: max, plan: yearly }', async () => {
        const assign = vi.fn()
        Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } })
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/billing') return BILLING
            if (url === '/api/billing/checkout') return { url: 'https://checkout.stripe.com/c/pay/m' }
            return {}
        })
        await act(async () => { renderPro(makeStore()) })
        fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Max' })).getByRole('radio', { name: /Jährlich/ }))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Weiter zur Bezahlung/ })) })
        const [, options] = apiFetch.mock.calls.find(([url]) => url === '/api/billing/checkout')
        expect(JSON.parse(options.body)).toMatchObject({ tier: 'max', plan: 'yearly' })
        expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/m')
    })

    it('a Pro subscriber sees "Auf Max upgraden" and the upgrade posts tier max', async () => {
        const proSub = { ...BILLING, active: true, tier: 'pro', canManageStripe: true, subscription: { provider: 'stripe', tier: 'pro', plan: 'yearly', status: 'active', periodEnd: '2027-11-01T10:00:00Z', cancelAtPeriodEnd: false } }
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/billing') return proSub
            if (url === '/api/billing/checkout') return { upgraded: true }
            return {}
        })
        await act(async () => { renderPro(makeStore({ pro: { active: true } })) })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Auf Max upgraden/ })) })
        const [, options] = apiFetch.mock.calls.find(([url]) => url === '/api/billing/checkout')
        expect(JSON.parse(options.body)).toMatchObject({ tier: 'max', plan: 'yearly' })
    })

    it('a Max subscriber gets no upgrade offer', async () => {
        const maxSub = { ...BILLING, active: true, tier: 'max', subscription: { provider: 'stripe', tier: 'max', plan: 'monthly', status: 'active', periodEnd: '2027-11-01T10:00:00Z', cancelAtPeriodEnd: false } }
        apiFetch.mockImplementation(async (url) => (url === '/api/billing' ? maxSub : {}))
        await act(async () => { renderPro(makeStore({ pro: { active: true }, max: { active: true } })) })
        expect(screen.queryByRole('button', { name: /Auf Max upgraden/ })).not.toBeInTheDocument()
    })
})

describe('Max: admin toggle', () => {
    it('sends { isMax: true }', async () => {
        const user = { id: 3, username: 'u2', displayName: 'user two', email: 'b@x.de', createdAt: '2026-10-02T10:00:00Z', isPro: false, isMax: false, isAdmin: false, isTester: false, request: null }
        const calls = []
        apiFetch.mockImplementation(async (url, options = {}) => {
            calls.push({ url, method: options.method ?? 'GET', body: options.body && JSON.parse(options.body) })
            if (url === '/api/me') return { isPro: true, isAdmin: true }
            if (url === '/api/admin/requests') return []
            if (url.startsWith('/api/admin/users?')) return { users: [user], total: 1 }
            if (url === '/api/admin/users/3' && options.method === 'PATCH') return { ...user, ...JSON.parse(options.body) }
            if (url === '/api/admin/overview') return { users: 1, withAccess: 1, admins: 1, testers: 0, pendingRequests: 0, newThisWeek: 0, openSharedSessions: 0, actions: [] }
            throw new Error(`unexpected ${url}`)
        })
        const store = makeStore({ isAdmin: true })
        await act(async () => {
            render(
                <Provider store={store}>
                    <MemoryRouter initialEntries={['/admin?tab=users']}>
                        <Routes><Route path="/admin" element={<Admin />} /></Routes>
                    </MemoryRouter>
                </Provider>
            )
        })
        const row = (await screen.findByText('user two')).closest('li')
        const toggle = within(row).getByRole('switch', { name: /Max/ })
        expect(toggle).toHaveAttribute('aria-checked', 'false')
        await act(async () => { fireEvent.click(toggle) })
        expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: '/api/admin/users/3', body: { isMax: true } })
        expect(within(row).getByRole('switch', { name: /Max/ })).toHaveAttribute('aria-checked', 'true')
    })
})
