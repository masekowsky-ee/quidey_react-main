import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import rootReducer from '../features/rootReducer'
import { apiFetch } from '../features/helperFunction'
import { SET_ACCESS } from '../features/auth/authActionTypes'
import { playPlans, buyInPlay, restorePlayPurchases, managePlaySubscription, upgradeInPlay, PLAY_PRODUCTS } from '../features/pro/pro'
import ProPage from '../components/pro/ProPage'

const { billing } = vi.hoisted(() => ({
    billing: { getPlans: vi.fn(), purchase: vi.fn(), restore: vi.fn(), manage: vi.fn(), getCapabilities: vi.fn() },
}))

vi.mock('@capacitor/core', async (importOriginal) => ({
    ...(await importOriginal()),
    registerPlugin: () => billing,
}))
vi.mock('../features/native/native', async (importOriginal) => ({
    ...(await importOriginal()),
    isNativeApp: () => true,
}))
vi.mock('../features/helperFunction', async (importOriginal) => ({
    ...(await importOriginal()),
    apiFetch: vi.fn(),
}))

const PRO_TOKEN = 'pro-token-aaaaaaaaaa'
const MAX_TOKEN = 'max-token-bbbbbbbbbb'
const PLANS = {
    quidey_pro: [{ basePlanId: 'monthly', price: '2,99 €', offerToken: 'o-pro-m' }, { basePlanId: 'yearly', price: '25,00 €', offerToken: 'o-pro-y' }],
    quidey_max: [{ basePlanId: 'monthly', price: '5,99 €', offerToken: 'o-max-m' }, { basePlanId: 'yearly', price: '49,00 €', offerToken: 'o-max-y' }],
}
const BILLING = { active: false, gift: false, tier: null, subscription: null, stripe: false, stripeMax: false, play: true, playAccountId: 'a'.repeat(64) }

beforeEach(() => {
    apiFetch.mockReset()
    for (const fn of Object.values(billing)) fn.mockReset()
    billing.getPlans.mockImplementation(async ({ productId }) => ({ plans: PLANS[productId] ?? [] }))
    billing.restore.mockResolvedValue({ purchases: [] })
    billing.manage.mockResolvedValue({})
    billing.getCapabilities.mockResolvedValue({ replace: true })
    localStorage.clear()
})

const proPhone = (purchases) => billing.restore.mockImplementation(async ({ productId }) => ({ purchases: productId === 'quidey_pro' ? purchases : [] }))
const postedTokens = () => apiFetch.mock.calls.filter(([url]) => url === '/api/billing/play').map(([, options]) => JSON.parse(options.body))

describe('Google Play: the client knows both products', () => {
    it('names the two product ids', () => {
        expect(PLAY_PRODUCTS).toEqual({ pro: 'quidey_pro', max: 'quidey_max' })
    })

    it('fetches the plans of Pro by default and of Max with its own product id', async () => {
        expect(await playPlans()).toEqual({ monthly: { price: '2,99 €', offerToken: 'o-pro-m' }, yearly: { price: '25,00 €', offerToken: 'o-pro-y' } })
        expect(billing.getPlans).toHaveBeenLastCalledWith({ productId: 'quidey_pro' })
        expect(await playPlans('max')).toEqual({ monthly: { price: '5,99 €', offerToken: 'o-max-m' }, yearly: { price: '49,00 €', offerToken: 'o-max-y' } })
        expect(billing.getPlans).toHaveBeenLastCalledWith({ productId: 'quidey_max' })
    })

    it('buying Max purchases quidey_max and hands only the token to the server', async () => {
        billing.purchase.mockResolvedValue({ purchaseToken: MAX_TOKEN })
        apiFetch.mockResolvedValue({ active: true, tier: 'max' })
        const status = await buyInPlay('yearly', 'o-max-y', 'acct', 'max')
        expect(billing.purchase).toHaveBeenCalledWith({ productId: 'quidey_max', offerToken: 'o-max-y', accountId: 'acct' })
        expect(postedTokens()).toEqual([{ purchaseToken: MAX_TOKEN }])
        expect(status).toEqual({ active: true, tier: 'max' })
    })

    it('Pro-only flow is unchanged (default tier, no old token)', async () => {
        billing.purchase.mockResolvedValue({ purchaseToken: PRO_TOKEN })
        apiFetch.mockResolvedValue({ active: true })
        await buyInPlay('monthly', 'o-pro-m', 'acct')
        expect(billing.purchase).toHaveBeenCalledWith({ productId: 'quidey_pro', offerToken: 'o-pro-m', accountId: 'acct' })
        expect(postedTokens()).toEqual([{ purchaseToken: PRO_TOKEN }])
    })

    it('a closed purchase sheet posts nothing', async () => {
        billing.purchase.mockResolvedValue({})
        expect(await buyInPlay('yearly', 'o-max-y', 'acct', 'max')).toBeNull()
        expect(apiFetch).not.toHaveBeenCalled()
    })

    it('a replace purchase passes the old token to the plugin as oldPurchaseToken', async () => {
        billing.purchase.mockResolvedValue({ purchaseToken: MAX_TOKEN })
        apiFetch.mockResolvedValue({ active: true, tier: 'max' })
        await buyInPlay('yearly', 'o-max-y', 'acct', 'max', { replaceToken: PRO_TOKEN })
        expect(billing.purchase).toHaveBeenCalledWith({ productId: 'quidey_max', offerToken: 'o-max-y', accountId: 'acct', oldPurchaseToken: PRO_TOKEN })
        expect(postedTokens()).toEqual([{ purchaseToken: MAX_TOKEN }])
    })

    it('upgradeInPlay for Play Pro looks up the single Pro token and replaces it', async () => {
        proPhone([{ purchaseToken: PRO_TOKEN }])
        billing.purchase.mockResolvedValue({ purchaseToken: MAX_TOKEN })
        apiFetch.mockResolvedValue({ active: true, tier: 'max' })
        await upgradeInPlay('monthly', 'o-max-m', 'acct', { hasPlayPro: true })
        expect(billing.purchase).toHaveBeenCalledWith({ productId: 'quidey_max', offerToken: 'o-max-m', accountId: 'acct', oldPurchaseToken: PRO_TOKEN })
    })

    it('Play Pro upgrade aborts when the phone has no Pro token (nothing is bought)', async () => {
        proPhone([])
        await expect(upgradeInPlay('monthly', 'o', 'acct', { hasPlayPro: true })).rejects.toMatchObject({ code: 'NO_PRO_TOKEN' })
        expect(billing.purchase).not.toHaveBeenCalled()
    })

    it('Play Pro upgrade aborts when the lookup throws (nothing is bought)', async () => {
        billing.restore.mockRejectedValue(new Error('boom'))
        await expect(upgradeInPlay('monthly', 'o', 'acct', { hasPlayPro: true })).rejects.toMatchObject({ code: 'NO_PRO_TOKEN' })
        expect(billing.purchase).not.toHaveBeenCalled()
    })

    it('with several Pro tokens the latest by purchaseTime is replaced', async () => {
        proPhone([{ purchaseToken: 'old-token-aaaaaaaa', purchaseTime: 100 }, { purchaseToken: PRO_TOKEN, purchaseTime: 300 }, { purchaseToken: 'mid-token-aaaaaaaa', purchaseTime: 200 }])
        billing.purchase.mockResolvedValue({ purchaseToken: MAX_TOKEN })
        apiFetch.mockResolvedValue({})
        await upgradeInPlay('monthly', 'o', 'acct', { hasPlayPro: true })
        expect(billing.purchase.mock.calls[0][0].oldPurchaseToken).toBe(PRO_TOKEN)
    })

    it('with several Pro tokens and no purchase times it aborts', async () => {
        proPhone([{ purchaseToken: 'a-token-aaaaaaaaa' }, { purchaseToken: 'b-token-bbbbbbbbb' }])
        await expect(upgradeInPlay('monthly', 'o', 'acct', { hasPlayPro: true })).rejects.toMatchObject({ code: 'NO_PRO_TOKEN' })
        expect(billing.purchase).not.toHaveBeenCalled()
    })

    it('Play Pro upgrade aborts when the plugin cannot replace (absent or false)', async () => {
        proPhone([{ purchaseToken: PRO_TOKEN }])
        billing.getCapabilities.mockRejectedValue(new Error('not implemented'))
        await expect(upgradeInPlay('monthly', 'o', 'acct', { hasPlayPro: true })).rejects.toMatchObject({ code: 'UPGRADE_UNAVAILABLE' })
        billing.getCapabilities.mockResolvedValue({ replace: false })
        await expect(upgradeInPlay('monthly', 'o', 'acct', { hasPlayPro: true })).rejects.toMatchObject({ code: 'UPGRADE_UNAVAILABLE' })
        expect(billing.purchase).not.toHaveBeenCalled()
    })

    it('a gifted Pro (no Play subscription) buys Max plainly, without any token', async () => {
        proPhone([{ purchaseToken: PRO_TOKEN }])
        billing.purchase.mockResolvedValue({ purchaseToken: MAX_TOKEN })
        apiFetch.mockResolvedValue({})
        await upgradeInPlay('monthly', 'o-max-m', 'acct')
        expect(billing.purchase).toHaveBeenCalledWith({ productId: 'quidey_max', offerToken: 'o-max-m', accountId: 'acct' })
        expect(billing.restore).not.toHaveBeenCalled()
    })

    it('restore covers both products and hands every token over once', async () => {
        billing.restore.mockImplementation(async ({ productId }) => ({ purchases: [{ purchaseToken: productId === 'quidey_pro' ? PRO_TOKEN : MAX_TOKEN }] }))
        apiFetch.mockResolvedValue({})
        expect(await restorePlayPurchases()).toEqual({ found: 2, accepted: 2 })
        expect(billing.restore).toHaveBeenCalledWith({ productId: 'quidey_pro' })
        expect(billing.restore).toHaveBeenCalledWith({ productId: 'quidey_max' })
        expect(postedTokens()).toEqual([{ purchaseToken: PRO_TOKEN }, { purchaseToken: MAX_TOKEN }])
    })

    it('restore still finds Pro when the Max lookup fails', async () => {
        billing.restore.mockImplementation(async ({ productId }) => {
            if (productId === 'quidey_max') throw new Error('unknown product')
            return { purchases: [{ purchaseToken: PRO_TOKEN }] }
        })
        apiFetch.mockResolvedValue({})
        expect(await restorePlayPurchases()).toEqual({ found: 1, accepted: 1 })
        expect(postedTokens()).toEqual([{ purchaseToken: PRO_TOKEN }])
    })

    it('restore counts only the tokens the server accepted (every post fails: 0)', async () => {
        billing.restore.mockImplementation(async ({ productId }) => ({ purchases: [{ purchaseToken: productId === 'quidey_pro' ? PRO_TOKEN : MAX_TOKEN }] }))
        apiFetch.mockRejectedValue(new Error('server down'))
        expect(await restorePlayPurchases()).toEqual({ found: 2, accepted: 0 })
        apiFetch.mockReset()
        apiFetch.mockImplementation(async (url, options) => { if (JSON.parse(options.body).purchaseToken === PRO_TOKEN) throw new Error('refused'); return {} })
        expect(await restorePlayPurchases()).toEqual({ found: 2, accepted: 1 })
    })

    it('manage opens the page of the account\'s tier', async () => {
        await managePlaySubscription('max')
        expect(billing.manage).toHaveBeenLastCalledWith({ productId: 'quidey_max' })
        await managePlaySubscription()
        expect(billing.manage).toHaveBeenLastCalledWith({ productId: 'quidey_pro' })
    })
})

function renderPage(access = {}) {
    const store = configureStore({ reducer: rootReducer })
    store.dispatch({ type: SET_ACCESS, payload: { isPro: true, accessMode: 'beta', ...access } })
    render(
        <Provider store={store}>
            <MemoryRouter initialEntries={['/pro']}><ProPage /></MemoryRouter>
        </Provider>
    )
}

describe('Google Play: the Pro page in the app', () => {
    it('shows the Max card with Play\'s price and buys Max', async () => {
        apiFetch.mockImplementation(async (url) => (url === '/api/billing' ? BILLING : { active: true, tier: 'max' }))
        billing.purchase.mockResolvedValue({ purchaseToken: MAX_TOKEN })
        await act(async () => { renderPage() })
        expect(screen.getByRole('heading', { name: 'Max' })).toBeInTheDocument()
        expect(screen.getByText(/49,00 €/)).toBeInTheDocument()
        expect(screen.queryByText(/Stripe/)).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('radiogroup', { name: 'Max' }).querySelector('[role="radio"]'))
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Mit Google Play abonnieren/ })) })
        expect(billing.purchase).toHaveBeenCalledWith({ productId: 'quidey_max', offerToken: 'o-max-y', accountId: 'a'.repeat(64) })
        expect(postedTokens()).toEqual([{ purchaseToken: MAX_TOKEN }])
    })

    it('without a Max product in Play only Pro is offered', async () => {
        billing.getPlans.mockImplementation(async ({ productId }) => ({ plans: productId === 'quidey_pro' ? PLANS.quidey_pro : [] }))
        apiFetch.mockImplementation(async (url) => (url === '/api/billing' ? BILLING : {}))
        await act(async () => { renderPage() })
        expect(screen.queryByRole('heading', { name: 'Max' })).not.toBeInTheDocument()
        expect(screen.getByText(/25,00 €/)).toBeInTheDocument()
    })

    it('a Pro subscriber from Play can upgrade, passing the old token', async () => {
        const active = { ...BILLING, active: true, tier: 'pro', subscription: { provider: 'play', tier: 'pro', plan: 'monthly', status: 'active', periodEnd: '2027-11-01T10:00:00Z', cancelAtPeriodEnd: false } }
        apiFetch.mockImplementation(async (url) => (url === '/api/billing' ? active : { ...active, tier: 'max' }))
        proPhone([{ purchaseToken: PRO_TOKEN }])
        billing.purchase.mockResolvedValue({ purchaseToken: MAX_TOKEN })
        await act(async () => { renderPage({ pro: { active: true } }) })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Auf Max upgraden/ })) })
        expect(billing.purchase).toHaveBeenCalledWith({ productId: 'quidey_max', offerToken: 'o-max-m', accountId: 'a'.repeat(64), oldPurchaseToken: PRO_TOKEN })
        expect(postedTokens()).toEqual([{ purchaseToken: MAX_TOKEN }])
    })

    it('without a plugin that can replace the upgrade button is hidden for Play Pro', async () => {
        billing.getCapabilities.mockRejectedValue(new Error('not implemented'))
        const active = { ...BILLING, active: true, tier: 'pro', subscription: { provider: 'play', tier: 'pro', plan: 'monthly', status: 'active', periodEnd: '2027-11-01T10:00:00Z', cancelAtPeriodEnd: false } }
        apiFetch.mockImplementation(async (url) => (url === '/api/billing' ? active : {}))
        await act(async () => { renderPage({ pro: { active: true } }) })
        expect(screen.queryByRole('button', { name: /Auf Max upgraden/ })).not.toBeInTheDocument()
    })

    it('a Play Pro whose token is missing sees an error and nothing is bought', async () => {
        const active = { ...BILLING, active: true, tier: 'pro', subscription: { provider: 'play', tier: 'pro', plan: 'monthly', status: 'active', periodEnd: '2027-11-01T10:00:00Z', cancelAtPeriodEnd: false } }
        apiFetch.mockImplementation(async (url) => (url === '/api/billing' ? active : {}))
        proPhone([])
        await act(async () => { renderPage({ pro: { active: true } }) })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Auf Max upgraden/ })) })
        expect(screen.getByRole('status')).toHaveTextContent(/nicht gefunden/)
        expect(billing.purchase).not.toHaveBeenCalled()
    })

    it('a gifted Pro is offered a plain Max purchase in the app', async () => {
        const gifted = { ...BILLING, active: true, gift: true, tier: 'pro', subscription: null }
        apiFetch.mockImplementation(async (url) => (url === '/api/billing' ? gifted : {}))
        billing.purchase.mockResolvedValue({ purchaseToken: MAX_TOKEN })
        billing.getCapabilities.mockRejectedValue(new Error('not implemented'))
        await act(async () => { renderPage({ pro: { active: true } }) })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Auf Max upgraden/ })) })
        expect(billing.purchase).toHaveBeenCalledWith({ productId: 'quidey_max', offerToken: 'o-max-y', accountId: 'a'.repeat(64) })
    })

    it('restore tells the truth: found but not accepted is an error, not "restored"', async () => {
        apiFetch.mockImplementation(async (url) => { if (url === '/api/billing') return BILLING; throw new Error('down') })
        billing.restore.mockImplementation(async ({ productId }) => ({ purchases: productId === 'quidey_pro' ? [{ purchaseToken: PRO_TOKEN }] : [] }))
        await act(async () => { renderPage() })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Käufe wiederherstellen' })) })
        expect(screen.getByRole('status')).toHaveTextContent(/nicht geklappt/)
        expect(screen.queryByText('Deine Käufe sind wiederhergestellt.')).not.toBeInTheDocument()
    })

    it('a Pro subscriber from Stripe is not offered an in-app upgrade', async () => {
        const active = { ...BILLING, active: true, tier: 'pro', subscription: { provider: 'stripe', tier: 'pro', plan: 'yearly', status: 'active', periodEnd: '2027-11-01T10:00:00Z', cancelAtPeriodEnd: false } }
        apiFetch.mockImplementation(async (url) => (url === '/api/billing' ? active : {}))
        await act(async () => { renderPage({ pro: { active: true } }) })
        expect(screen.queryByRole('button', { name: /Auf Max upgraden/ })).not.toBeInTheDocument()
    })

    it('manage for a Max subscription opens the Max subscription page', async () => {
        const active = { ...BILLING, active: true, tier: 'max', subscription: { provider: 'play', tier: 'max', plan: 'yearly', status: 'active', periodEnd: '2027-11-01T10:00:00Z', cancelAtPeriodEnd: false } }
        apiFetch.mockImplementation(async (url) => (url === '/api/billing' ? active : {}))
        await act(async () => { renderPage({ pro: { active: true }, max: { active: true } }) })
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Abo verwalten' })) })
        expect(billing.manage).toHaveBeenCalledWith({ productId: 'quidey_max' })
    })
})
