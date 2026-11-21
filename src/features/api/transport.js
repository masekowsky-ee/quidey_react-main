// The wire: where the API lives, which headers every request carries, how an error answer becomes
// an Error. No offline copy and no answer cache in here (that is api.js with offline/offline.js);
// requests that must bypass them (the start check, the usage queue, a sign-out) use rawFetch.
import { platform } from '../usage/platform';
import { openAuth } from '../auth/gate';
import { session } from './session';
import { ACCESS_CODES, LIMIT_EVENT, PRO_REQUIRED_EVENT, SIGNED_OUT_CODES, SIGNED_OUT_EVENT } from './events';

// Full URL for an API path. VITE_API_URL is the backend's address in production builds
// (e.g. https://api.quidey.example.com); locally it's empty and Vite's proxy forwards /api.
export const apiBase = () => (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export function apiUrl(path) {
    return apiBase() + path;
}

// A gateway with nobody behind it (the API restarts): the same as no connection
export const SERVER_GONE_STATUSES = [502, 503, 504];

// What may be read without an account (everything else a visitor's page asks for stays off the network)
const PUBLIC_READS = ['/api/auth/'];

// One fetch with the app's headers; answers the Response as it is. The token defaults to the one
// on the device; pass null for a request that must go without one, or the old one when signing
// out removes it first.
export function rawFetch(url, options = {}, token = session.token()) {
    return fetch(apiUrl(url), {
        ...options,
        headers: {
            ...options.headers,
            "Content-Type": "application/json",
            // the usage statistics' platform: web, pwa or android
            "X-Quidey-Platform": platform(),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });
}

// Gives up on a request after `ms` (it then rejects with an AbortError, "server unreachable").
// { signal, done }: pass the signal on, call done() when the request is over.
export function abortAfter(ms) {
    const controller = new AbortController();
    const timer = ms ? setTimeout(() => controller.abort(), ms) : null;
    return { signal: controller.signal, done: () => clearTimeout(timer) };
}

// The JSON body of a request: json('PUT', { done: true }) is { method: 'PUT', body: '{"done":true}' }.
// Without a body only the method.
export function json(method, body, extra) {
    return { method, body: body === undefined ? undefined : JSON.stringify(body), ...extra };
}

// The real request: JSON in and out, errors thrown with status / code / field / data.
export async function request(url, options = {}) {
    const token = session.token();

    // a visitor without an account: reading what is only for accounts fails at once, without a request
    // (the page shows itself empty); saving it goes to the server, which refuses and so asks them to sign in
    if (!token && (options.method ?? 'GET') === 'GET' && !PUBLIC_READS.some(prefix => url.startsWith(prefix))) {
        const error = new Error('Not signed in');
        error.status = 401;
        error.code = 'NO_ACCOUNT';
        throw error;
    }

    const response = await rawFetch(url, options, token);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || "Request failed");
        // status and the API's error code let the UI show a translated message
        error.status = response.status;
        error.code = errorData.code;
        // which input the server refused (INVALID_INPUT)
        error.field = errorData.field;
        // the whole error body (a 409 plan_changed carries the fresh preview)
        error.data = errorData;
        // pro / tester was taken away while the app is open: App checks access again
        // (and shows the beta screen, or hides what only testers see)
        if (ACCESS_CODES.includes(errorData.code)) window.dispatchEvent(new Event(PRO_REQUIRED_EVENT));
        // a visitor without an account tried to save something: ask them to sign in (reads fail
        // quietly). The text is the backend's own, see authenticateToken in the api's index.js.
        if (!token && response.status === 401 && (options.method ?? 'GET') !== 'GET' && errorData.error === 'No existing token') openAuth();
        if (token && SIGNED_OUT_CODES.includes(errorData.code)) window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
        if (errorData.code === 'LIMIT_REACHED') {
            error.limit = errorData.limit;
            window.dispatchEvent(new CustomEvent(LIMIT_EVENT, { detail: { limit: errorData.limit, max: errorData.max } }));
        }
        throw error;
    }

    return response.json();
}

// The translated text for an API error code of one feature: errorText(t, 'friendError', 'X') is
// t('friendError_X'), or the generic text when that key doesn't exist (t answers the key itself then)
export function errorText(t, prefix, code, generic = 'friendError_generic') {
    const key = `${prefix}_${code}`;
    return t(key) === key ? t(generic) : t(key);
}
