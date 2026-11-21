// Every request to the API. Reads are kept on the device and answered from there when the server
// can't be reached; some writes wait in a queue meanwhile (features/offline/offline.js).
// On top of that, { cacheMs } keeps an answer in memory for a while (api/cache.js).
//
// Files:  session.js (the token)  events.js (window events)  cache.js (answer cache)
//         transport.js (headers, errors, rawFetch)  ../offline/offline.js (offline copy + outbox)
import { withOffline } from '../offline/offline';
import { request } from './transport';
import { session } from './session';
import { answers, clearApiCache, keepCacheFor } from './cache';

export { apiUrl, rawFetch, json, errorText } from './transport';
export { CACHE_SHORT, CACHE_MEDIUM, CACHE_LONG, clearApiCache } from './cache';
export { PRO_REQUIRED_EVENT, SIGNED_OUT_EVENT, LIMIT_EVENT } from './events';
export { session } from './session';

export async function apiFetch(url, options = {}) {
    const { cacheMs, fresh, ...fetchOptions } = options;
    const token = session.token();
    const isGet = !fetchOptions.method || fetchOptions.method.toUpperCase() === 'GET';
    keepCacheFor(token);
    if (!isGet) {
        const done = await withOffline(url, fetchOptions, request);
        clearApiCache();
        return done;
    }
    if (!cacheMs) return withOffline(url, fetchOptions, request);
    const hit = answers.get(url);
    if (!fresh && hit) {
        if (hit.pending) return hit.pending;
        if (Date.now() - hit.at < hit.ttl) return hit.value;
    }
    const pending = withOffline(url, fetchOptions, request).then((value) => {
        if (answers.get(url)?.pending === pending) answers.set(url, { at: Date.now(), ttl: cacheMs, value });
        return value;
    }, (err) => {
        if (answers.get(url)?.pending === pending) answers.delete(url);
        throw err;
    });
    answers.set(url, { pending });
    return pending;
}
