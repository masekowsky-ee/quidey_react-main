// Anonymous usage statistics (spec 2026-11-07, section 4): events wait in a small queue and go to
// the Quidey server as POST /api/usage, only while the account said yes (setUsageEnabled). The
// queue is kept in sessionStorage so a reload loses nothing; saying no or signing out empties it
// without sending. Never content, names or ids: only metric names from the lists below.
// The queue belongs to the account that made it (`{ userId, events }`): events of another account
// (another tab signed in as someone else, a queue left from before) are dropped, never sent.
import { apiUrl, SIGNED_OUT_EVENT } from '../helperFunction';
import { platform } from './platform';

export { platform };

const KEY = 'usageQueue';
export const QUEUE_MAX = 500;
const CHUNK = 200;
const KEEPALIVE_BYTES = 60_000;
const FLUSH_MS = 60_000;

// what the client may send (the server counts task_created, task_done and focus_done itself)
const ACTIONS = ['app_open', 'active_minute', 'focus_start', 'group_created', 'friend_request_sent', 'friend_added',
    'shared_session_created', 'family_created', 'routine_run', 'note_written', 'study_plan_applied', 'reminder_created'];
const AREAS = ['home', 'calendar', 'focus', 'stats', 'profile', 'settings', 'inbox', 'feedback', 'admin', 'tester', 'fun', 'pro', 'beta',
    'notes', 'study', 'user_profile', 'session', 'family', 'routines', 'routine_run', 'community', 'community_progress',
    'community_sessions', 'community_friends', 'community_family', 'other'];

export const isClientMetric = (metric) => ACTIONS.includes(metric)
    || (typeof metric === 'string' && metric.startsWith('view:') && AREAS.includes(metric.slice(5)));

let enabled = false;
let owner = null;
let queue = [];
let timer = null;
let listening = false;

const readToken = () => {
    try { return localStorage.getItem('token'); } catch { return null; /* blocked storage */ }
};

// the account a sign-in token belongs to (its payload carries userId), null when it can't be read
const tokenUser = (token) => {
    try {
        const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const id = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '='))).userId;
        return id ?? null;
    } catch {
        return null;
    }
};

// what a reload left, only when it belongs to this account (the old plain list has no account: dropped)
const readStored = (userId) => {
    try {
        const stored = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
        if (!stored || Array.isArray(stored) || userId == null || stored.userId !== userId || !Array.isArray(stored.events)) return [];
        return stored.events.filter(e => e && isClientMetric(e.metric) && Number.isFinite(e.at)).slice(-QUEUE_MAX);
    } catch {
        return [];
    }
};

const store = () => {
    try {
        if (queue.length) sessionStorage.setItem(KEY, JSON.stringify({ userId: owner, events: queue }));
        else sessionStorage.removeItem(KEY);
    } catch { /* blocked storage: the queue stays in memory */ }
};

const clear = () => {
    queue = [];
    try { sessionStorage.removeItem(KEY); } catch { /* blocked storage */ }
};

// a start without a sign-in: whatever an earlier one left in this tab goes
if (!readToken()) clear();

function onVisibility() {
    if (document.visibilityState === 'hidden') flushUsage({ keepalive: true });
}

function listen(on) {
    if (on === listening) return;
    listening = on;
    const method = on ? 'addEventListener' : 'removeEventListener';
    document[method]('visibilitychange', onVisibility);
    window[method](SIGNED_OUT_EVENT, clear);
}

// userId: the account counting is for (access.userId); the queue is bound to it
export function setUsageEnabled(value, userId = null) {
    const next = Boolean(value);
    if (next && enabled && timer && owner === userId) return;
    if (next && owner !== userId) queue = [];
    enabled = next;
    if (next) {
        owner = userId;
        queue = [...readStored(userId), ...queue].slice(-QUEUE_MAX);
        store();
        listen(true);
        if (!timer) timer = setInterval(() => { flushUsage(); }, FLUSH_MS);
    } else {
        clearInterval(timer);
        timer = null;
        owner = null;
        listen(false);
        clear();
    }
}

export function track(metric, value) {
    if (!enabled || !isClientMetric(metric)) return;
    const event = { metric, at: Date.now() };
    if (Number.isFinite(value)) event.value = value;
    queue.push(event);
    if (queue.length > QUEUE_MAX) queue = queue.slice(-QUEUE_MAX);
    store();
}

const body = (events) => JSON.stringify({
    platform: platform(),
    events: events.map(({ metric, at, value }) => ({ metric, at: new Date(at).toISOString(), ...(value !== undefined ? { value } : {}) })),
});

// the next part of the list that fits one request (keepalive requests may carry 64 KB in all)
function takeChunk(keepalive) {
    let size = Math.min(CHUNK, queue.length);
    while (keepalive && size > 1 && body(queue.slice(0, size)).length > KEEPALIVE_BYTES) size = Math.floor(size / 2);
    return queue.splice(0, size);
}

export async function flushUsage({ keepalive = false } = {}) {
    const token = readToken();
    if (!enabled || !token || !queue.length) return;
    // signed in as somebody else meanwhile (another tab): these events are not theirs
    if (owner == null || tokenUser(token) !== owner) { clear(); return; }
    while (enabled && queue.length) {
        const events = takeChunk(keepalive);
        store();
        let status;
        try {
            const response = await fetch(apiUrl('/api/usage'), {
                method: 'POST',
                keepalive,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Quidey-Platform': platform() },
                body: body(events),
            });
            status = response.status;
        } catch {
            status = 0;
        }
        if (status >= 200 && status < 300) continue;
        // the account is no longer valid: nothing of it is kept
        if (status === 401 || status === 403) { clear(); return; }
        // a chunk the server will never take (malformed, too big): dropped, so it can't block newer events
        if (status === 400 || status === 413) return;
        // not taken (offline, 429, 5xx …): back in front, and no more tries until the next beat
        if (enabled) { queue = [...events, ...queue].slice(-QUEUE_MAX); store(); }
        return;
    }
}

// Only for tests: as on a fresh start
export function resetUsage() {
    enabled = true;
    setUsageEnabled(false);
    queue = [];
}
