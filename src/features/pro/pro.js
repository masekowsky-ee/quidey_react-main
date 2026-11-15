// Quidey Pro: the subscription that exists to support the development (2,99 € a month or 25 € a
// year). Web: Stripe (checkout and customer portal pages, GET/POST /api/billing…). Android app:
// Google Play Billing through the app's plugin "QuideyBilling" (android/…/BillingPlugin.java):
// Google Play only allows its own billing for that, and the app never points to another way.
//
// What Pro means, from the server (/api/me → state.auth.access): pro { active, gift, until } and max { active, gift, until } (Max includes Pro);
// accessMode 'beta' (testers, Pro and admins get in) or 'open' (everybody, with the free plan's
// limits: access.limits / access.usage; null for Pro, testers and admins).
import { registerPlugin } from '@capacitor/core';
import { useSelector } from 'react-redux';
import { apiFetch, LIMIT_EVENT } from '../helperFunction';
import { isNativeApp } from '../native/native';

// The prices as shown (the real ones live at Stripe / in the Play Console: keep them the same)
export const PRICES = { monthly: 2.99, yearly: 25 };
// 12 months at the monthly price against one year: 35,88 € → 25 €
export const YEARLY_SAVES = Math.round((PRICES.monthly * 12 - PRICES.yearly) * 100) / 100;
export const YEARLY_SAVES_PERCENT = Math.round((YEARLY_SAVES / (PRICES.monthly * 12)) * 100);
export const YEARLY_PER_MONTH = Math.floor((PRICES.yearly / 12) * 100) / 100;

// Quidey Max (5,99 € a month or 49 € a year) is Pro plus the AI assistant; Max includes Pro
export const MAX_PRICES = { monthly: 5.99, yearly: 49 };
export const PRICES_BY_TIER = { pro: PRICES, max: MAX_PRICES };
export const yearlySaves = (tier) => Math.round((PRICES_BY_TIER[tier].monthly * 12 - PRICES_BY_TIER[tier].yearly) * 100) / 100;
export const yearlySavesPercent = (tier) => Math.round((yearlySaves(tier) / (PRICES_BY_TIER[tier].monthly * 12)) * 100);
export const yearlyPerMonth = (tier) => Math.floor((PRICES_BY_TIER[tier].yearly / 12) * 100) / 100;

export const formatEuro = (value, language) => new Intl.NumberFormat(language === 'en' ? 'en-IE' : 'de-DE', { style: 'currency', currency: 'EUR' }).format(value);

const PLAY_PRODUCT = 'quidey_pro';
const QuideyBilling = registerPlugin('QuideyBilling');

// In the app, Google Play sells it; on the web, Stripe
export const sellsThroughPlay = () => isNativeApp();

// GET /api/billing: { active, gift, until, subscription, canManageStripe, stripe, play, prices, playAccountId }
export const fetchBilling = () => apiFetch('/api/billing');

// Web: on to Stripe's checkout page for a tier ('pro' | 'max') and 'monthly' | 'yearly' (leaves the
// page). A running Stripe Pro bought up to Max is changed in place: the server answers
// { upgraded: true } and there is no page to go to; that answer is returned.
export async function startCheckout(plan, language, tier = 'pro') {
    const result = await apiFetch('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ tier, plan, language }) });
    if (result?.url) window.location.assign(result.url);
    return result;
}

// Web: Stripe's customer portal (plan, payment method, invoices, cancel)
export async function openPortal() {
    const { url } = await apiFetch('/api/billing/portal', { method: 'POST' });
    window.location.assign(url);
}

// App: the plans as Google Play sells them, with Play's own prices in the person's currency:
// { monthly: { price, offerToken }, yearly: { price, offerToken } } (null when Play can't say)
export async function playPlans() {
    try {
        const { plans } = await QuideyBilling.getPlans({ productId: PLAY_PRODUCT });
        return Object.fromEntries((plans ?? []).map((plan) => [plan.basePlanId, { price: plan.price, offerToken: plan.offerToken }]));
    } catch {
        return null;
    }
}

// App: buys a plan in Google Play and hands the purchase to the server, which checks it with
// Google. Resolves the new status, or null when the purchase was closed without buying.
export async function buyInPlay(plan, offerToken, accountId) {
    const result = await QuideyBilling.purchase({ productId: PLAY_PRODUCT, offerToken, accountId });
    if (!result?.purchaseToken) return null;
    return apiFetch('/api/billing/play', { method: 'POST', body: JSON.stringify({ purchaseToken: result.purchaseToken }) });
}

// App: purchases Google Play knows on this phone are handed over again (another device, a new
// install, a purchase whose answer got lost). Quietly does nothing outside the app.
export async function restorePlayPurchases() {
    if (!isNativeApp()) return false;
    try {
        const { purchases } = await QuideyBilling.restore({ productId: PLAY_PRODUCT });
        for (const purchase of purchases ?? []) {
            await apiFetch('/api/billing/play', { method: 'POST', body: JSON.stringify({ purchaseToken: purchase.purchaseToken }) }).catch(() => {});
        }
        return (purchases ?? []).length > 0;
    } catch {
        return false;
    }
}

// App: Google Play's page of my subscriptions (change, cancel)
export function managePlaySubscription() {
    return QuideyBilling.manage({ productId: PLAY_PRODUCT }).catch(() => {});
}

// Fired by apiFetch when the free plan is full: { limit, max } (App shows LimitDialog)
export { LIMIT_EVENT };

// Do I have Max (paid, gifted, or as an admin)?
export const selectHasMax = (state) => Boolean(state.auth.access.max?.active);

// Do I really support Quidey (a gift, or a running paid subscription)? pro.active is also true for
// admins, who count as Max without a gift or a subscription: they are not shown "thank you" texts.
export const selectIsSupporter = (state) => {
    const { pro, max, isAdmin } = state.auth.access;
    if (!pro?.active) return false;
    if (!isAdmin) return true;
    const running = (until) => Boolean(until) && new Date(until) > new Date();
    return Boolean(pro.gift || max?.gift || running(pro.until) || running(max?.until));
};

// My plan in short: { pro, max, limited, limits, usage, accessMode }
export function usePlan() {
    const access = useSelector((state) => state.auth.access);
    return {
        pro: Boolean(access.pro?.active),
        max: Boolean(access.max?.active),
        limited: Boolean(access.limits),
        limits: access.limits,
        usage: access.usage,
        accessMode: access.accessMode,
    };
}
