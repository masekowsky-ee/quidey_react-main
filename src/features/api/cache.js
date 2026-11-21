import { SIGNED_OUT_EVENT } from './events';

// ---------- answer cache ----------
// apiFetch(url, { cacheMs }) keeps the answer of a GET in memory for cacheMs (no personal data
// leaves the page): the same data needed again within that time (reopening a page, several
// components asking at once) costs no request. Asked at the same moment, one request is shared.
// Anything that changes data (every non-GET), signing out and signing in empty the cache, so a
// change of mine is never hidden behind an old answer. Only use it for data that doesn't change
// behind my back (not for what the live connection delivers: tasks, messages, friends, sessions).
// { fresh: true } skips the cache for one call (pull to refresh) and stores the new answer.
export const CACHE_SHORT = 30 * 1000;
export const CACHE_MEDIUM = 5 * 60 * 1000;
export const CACHE_LONG = 60 * 60 * 1000;
export const answers = new Map();   // key -> { at, ttl, value } | { pending: Promise }
let cacheOwner = null;

export function clearApiCache() {
    answers.clear();
}
if (typeof window !== 'undefined') window.addEventListener(SIGNED_OUT_EVENT, clearApiCache);

// another account (switching) never sees the answers of the previous one
export function keepCacheFor(token) {
    if (token !== cacheOwner) { clearApiCache(); cacheOwner = token; }
}
