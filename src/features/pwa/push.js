// Push notifications on this device (Settings → App, and the question after the first task).
// The browser asks its push service for an address (a "subscription"), the API keeps it
// (PUT /api/push/subscription) and sends what's due there: tasks and events at their time, the
// morning overview, messages, requests and invites (see the backend's utils/push.js). The
// service worker (pwa.js) shows them, also while Quidey is closed.
//
// On or off is a choice of this device: localStorage 'push' ('on' | 'off'), the address in
// 'pushEndpoint' (to remove it from the server on sign-out without waiting for the worker).
// Every start of the app checks it again (refreshPush): the permission can be taken back in the
// browser, the push service can renew the address, another account can be signed in.
// 'pushAsked': the question after creating a task came once on this device.
import { useEffect, useSyncExternalStore } from 'react';
import { apiFetch, apiUrl } from '../helperFunction';
import { installState } from './install';

const WANTED_KEY = 'push';
const ENDPOINT_KEY = 'pushEndpoint';
const ASKED_KEY = 'pushAsked';
const READY_TIMEOUT_MS = 10 * 1000;

// The kinds each device can switch on or off (columns on the server)
export const PUSH_KINDS = ['plan', 'digest', 'messages', 'social'];

// status: 'unknown' (not checked yet) | 'unsupported' (this browser can't) | 'install' (iPhone /
// iPad: only as an app on the home screen) | 'denied' (blocked in the browser's settings) |
// 'unavailable' (the server sends none) | 'off' | 'on'.
// kinds: what this device gets, while on. asking: the question after the first task is open.
let state = { status: 'unknown', kinds: null, busy: false, error: null, asking: false };
const listeners = new Set();
const set = (changes) => {
    state = { ...state, ...changes };
    listeners.forEach((listener) => listener());
};

const read = (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
};
const write = (key, value) => {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch { /* blocked storage: only this visit */ }
};

export const pushWanted = () => read(WANTED_KEY) === 'on';

// Whether a push of this kind reaches this device (then the app shows no system notification
// of its own for it, see tasks/reminders.js)
export const pushCovers = (kind) => pushWanted() && state.status === 'on' && state.kinds?.[kind] !== false;

// 'supported', 'install' (Safari on iPhone / iPad outside the home screen) or 'unsupported'
export function pushSupport() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported';
    if ('serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined') return 'supported';
    return installState() === 'ios' ? 'install' : 'unsupported';
}

// The server's public key as the bytes the browser wants ("applicationServerKey")
export function keyBytes(base64url) {
    const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

const sameKey = (subscription, bytes) => {
    const current = subscription.options?.applicationServerKey;
    if (!current) return true;
    const view = new Uint8Array(current);
    return view.length === bytes.length && view.every((byte, i) => byte === bytes[i]);
};

let publicKey;
async function serverKey() {
    if (publicKey === undefined) publicKey = (await apiFetch('/api/push/key')).publicKey ?? null;
    return publicKey;
}

// The service worker that shows the notifications (registerServiceWorker.js registers it at
// startup; here it's waited for, at most READY_TIMEOUT_MS)
async function worker() {
    await navigator.serviceWorker.register('/sw.js');
    return Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker not ready')), READY_TIMEOUT_MS)),
    ]);
}

async function currentSubscription() {
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
}

// Hands this device's address to the server (for the account signed in now); kinds optional
async function save(subscription, kinds) {
    const { endpoint, keys } = subscription.toJSON();
    const data = await apiFetch('/api/push/subscription', {
        method: 'PUT',
        body: JSON.stringify({ endpoint, keys, ...(kinds ? { kinds } : {}) }),
    });
    write(ENDPOINT_KEY, endpoint);
    return data.kinds;
}

async function subscribe(key) {
    const registration = await worker();
    const bytes = keyBytes(key);
    let subscription = await registration.pushManager.getSubscription();
    // made for another key (the server's keys changed): a new one
    if (subscription && !sameKey(subscription, bytes)) {
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
    }
    return subscription ?? registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
}

async function removeFromServer(endpoint) {
    if (endpoint) await apiFetch('/api/push/subscription', { method: 'DELETE', body: JSON.stringify({ endpoint }) }).catch(() => {});
    write(ENDPOINT_KEY, null);
}

// Looks at how things stand and puts them right: called on every start of the app (signed in,
// with access) and when the settings open
export async function refreshPush() {
    const support = pushSupport();
    if (support !== 'supported') return set({ status: support, kinds: null });
    try {
        const permission = Notification.permission;
        if (!pushWanted() || permission !== 'granted') {
            // off here, or the browser no longer allows it: nothing may stay behind on the server
            const subscription = await currentSubscription();
            if (pushWanted() || subscription) {
                await removeFromServer(subscription?.endpoint ?? read(ENDPOINT_KEY));
                await subscription?.unsubscribe().catch(() => {});
            }
            if (pushWanted()) write(WANTED_KEY, 'off');
            return set({ status: permission === 'denied' ? 'denied' : 'off', kinds: null });
        }
        const key = await serverKey();
        if (!key) return set({ status: 'unavailable', kinds: null });
        const kinds = await save(await subscribe(key));
        set({ status: 'on', kinds, error: null });
    } catch {
        // offline or the worker didn't come up: shown as it was chosen, checked again next start
        set({ status: pushWanted() ? 'on' : 'off' });
    }
}

// Turns them on for this device. Call it right from a click: browsers only ask for the
// permission then (Safari in particular), so that comes first.
export async function enablePush() {
    if (pushSupport() !== 'supported') return false;
    set({ busy: true, error: null });
    try {
        const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
        if (permission !== 'granted') {
            set({ status: permission === 'denied' ? 'denied' : 'off' });
            return false;
        }
        const key = await serverKey();
        if (!key) {
            set({ status: 'unavailable' });
            return false;
        }
        const kinds = await save(await subscribe(key));
        write(WANTED_KEY, 'on');
        set({ status: 'on', kinds });
        return true;
    } catch {
        set({ error: 'pushErrorOn' });
        return false;
    } finally {
        set({ busy: false });
    }
}

// Turns them off for this device: gone from the server, and the browser drops the address
export async function disablePush() {
    set({ busy: true, error: null });
    write(WANTED_KEY, 'off');
    try {
        const subscription = await currentSubscription().catch(() => null);
        await removeFromServer(subscription?.endpoint ?? read(ENDPOINT_KEY));
        await subscription?.unsubscribe().catch(() => {});
    } finally {
        set({ status: Notification.permission === 'denied' ? 'denied' : 'off', kinds: null, busy: false });
    }
}

// One kind on or off for this device ({ plan: false }); shown at once, put back if it fails
export async function setPushKind(kind, on) {
    const before = state.kinds;
    set({ kinds: { ...before, [kind]: on }, error: null });
    try {
        const subscription = await currentSubscription();
        if (!subscription) throw new Error('Not subscribed');
        set({ kinds: await save(subscription, { [kind]: on }) });
    } catch {
        set({ kinds: before, error: 'pushErrorSave' });
    }
}

// A test notification to this device; true when the server handed it over
export async function sendTestPush() {
    set({ error: null });
    try {
        const subscription = await currentSubscription();
        if (!subscription) throw new Error('Not subscribed');
        await apiFetch('/api/push/test', { method: 'POST', body: JSON.stringify({ endpoint: subscription.endpoint }) });
        return true;
    } catch {
        set({ error: 'pushErrorTest' });
        return false;
    }
}

// Signing out: this device gets nothing more for that account. The token is still the old one
// (the sign-out removes it right after), so this goes out with it and isn't waited for. When
// another account takes over (`keep`), the device stays on and goes over to that one on the
// next start; otherwise the next person signing in here decides for themselves.
export function forgetPushOnSignOut(token, keep = false) {
    const endpoint = read(ENDPOINT_KEY);
    if (endpoint && token) {
        fetch(apiUrl('/api/push/subscription'), {
            method: 'DELETE',
            keepalive: true,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ endpoint }),
        }).catch(() => {});
    }
    if (!keep) {
        write(WANTED_KEY, null);
        write(ENDPOINT_KEY, null);
    }
}

// After a task was created: asks once per device whether notifications should come, while they
// are off and the browser hasn't blocked them
export function offerPushAfterTask() {
    if (state.status !== 'off' || read(ASKED_KEY)) return;
    if (typeof Notification === 'undefined' || Notification.permission === 'denied') return;
    write(ASKED_KEY, '1');
    set({ asking: true });
}

// The answer to that question; yes comes from a click, so it can ask for the permission
export function answerPushOffer(yes) {
    set({ asking: false });
    if (yes) return enablePush();
    return Promise.resolve(false);
}

const subscribeStore = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const usePushState = () => useSyncExternalStore(subscribeStore, () => state, () => state);

// In the app shell: checks this device on every start (and for another account), and opens the
// page a clicked notification points to (the service worker's 'quidey:open', see pwa.js)
export function usePushSync(enabled, account, navigate) {
    useEffect(() => {
        if (enabled) refreshPush();
    }, [enabled, account]);

    useEffect(() => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
        const onMessage = (event) => {
            const url = event.data?.type === 'quidey:open' ? event.data.url : null;
            // only addresses inside the app
            if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) navigate(url);
        };
        navigator.serviceWorker.addEventListener('message', onMessage);
        navigator.serviceWorker.startMessages?.();
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [navigate]);
}

// Only for tests: back to the start
export function resetPushState() {
    publicKey = undefined;
    state = { status: 'unknown', kinds: null, busy: false, error: null, asking: false };
}
