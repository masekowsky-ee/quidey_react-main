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

// The two subscriptions in Google Play (base plans 'monthly' and 'yearly' each); the server maps product -> tier
export const PLAY_PRODUCTS = { pro: 'quidey_pro', max: 'quidey_max' };
const productOf = (tier) => PLAY_PRODUCTS[tier] ?? PLAY_PRODUCTS.pro;
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

// App: the plans of a tier ('pro' | 'max') as Google Play sells them, with Play's own prices in the
// person's currency: { monthly: { price, offerToken }, yearly: { price, offerToken } } (null when
// Play can't say, {} when the product has no plans)
export async function playPlans(tier = 'pro') {
    try {
        const { plans } = await QuideyBilling.getPlans({ productId: productOf(tier) });
        return Object.fromEntries((plans ?? []).map((plan) => [plan.basePlanId, { price: plan.price, offerToken: plan.offerToken }]));
    } catch {
        return null;
    }
}

const sendPlayToken = (purchaseToken) => apiFetch('/api/billing/play', { method: 'POST', body: JSON.stringify({ purchaseToken }) });

// App: buys a plan of a tier in Google Play and hands the purchase to the server, which checks it
// with Google (the server finds the tier from the product, only the token goes). Resolves the new
// status, or null when the purchase was closed without buying. { replaceToken }: the token of the
// subscription this one replaces (Pro -> Max); it goes to the plugin as `oldPurchaseToken`, which
// makes a replace purchase of it (BillingPlugin.java must support that parameter).
export async function buyInPlay(plan, offerToken, accountId, tier = 'pro', { replaceToken } = {}) {
    const request = { productId: productOf(tier), offerToken, accountId };
    if (replaceToken) request.oldPurchaseToken = replaceToken;
    const result = await QuideyBilling.purchase(request);
    if (!result?.purchaseToken) return null;
    return sendPlayToken(result.purchaseToken);
}

// The purchase tokens Google Play knows on this phone for a tier's product
async function playTokens(tier) {
    const { purchases } = await QuideyBilling.restore({ productId: productOf(tier) });
    return (purchases ?? []).map((purchase) => purchase.purchaseToken).filter(Boolean);
}

// App: a Pro subscriber from Google Play goes up to Max: the phone's Pro token is replaced by the
// Max purchase (no second subscription side by side). Without a Pro token on this phone it is a plain purchase.
export async function upgradeInPlay(plan, offerToken, accountId) {
    const [replaceToken] = await playTokens('pro').catch(() => []);
    return buyInPlay(plan, offerToken, accountId, 'max', { replaceToken });
}

// App: purchases Google Play knows on this phone are handed over again (another device, a new
// install, a purchase whose answer got lost), for Pro and for Max. Quietly does nothing outside the app.
export async function restorePlayPurchases() {
    if (!isNativeApp()) return false;
    const found = new Set();
    for (const tier of Object.keys(PLAY_PRODUCTS)) {
        try {
            for (const token of await playTokens(tier)) found.add(token);
        } catch { /* this product can't be read: the other one still can */ }
    }
    for (const token of found) await sendPlayToken(token).catch(() => {});
    return found.size > 0;
}

// App: Google Play's page of my subscriptions for a tier (change, cancel)
export function managePlaySubscription(tier = 'pro') {
    return QuideyBilling.manage({ productId: productOf(tier) }).catch(() => {});
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
