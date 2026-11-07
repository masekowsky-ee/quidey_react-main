// Anonymous usage statistics (spec 2026-11-07, section 4): events wait in a small queue and go to
// the Quidey server as POST /api/usage, only while the account said yes (setUsageEnabled). The
// queue is kept in sessionStorage so a reload loses nothing; saying no or signing out empties it
// without sending. Never content, names or ids: only metric names from the lists below.
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
let queue = [];
let timer = null;
let listening = false;

const readStored = () => {
    try {
        const list = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
        return Array.isArray(list) ? list.filter(e => e && isClientMetric(e.metric) && Number.isFinite(e.at)).slice(-QUEUE_MAX) : [];
    } catch {
        return [];
    }
};

const store = () => {
    try {
        if (queue.length) sessionStorage.setItem(KEY, JSON.stringify(queue));
        else sessionStorage.removeItem(KEY);
    } catch { /* blocked storage: the queue stays in memory */ }
};

const clear = () => {
    queue = [];
    try { sessionStorage.removeItem(KEY); } catch { /* blocked storage */ }
};

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

export function setUsageEnabled(value) {
    const next = Boolean(value);
    if (next === enabled && next === Boolean(timer)) return;
    enabled = next;
    if (next) {
        queue = [...readStored(), ...queue].slice(-QUEUE_MAX);
        listen(true);
        if (!timer) timer = setInterval(() => { flushUsage(); }, FLUSH_MS);
    } else {
        clearInterval(timer);
        timer = null;
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
    let token = null;
    try { token = localStorage.getItem('token'); } catch { /* blocked storage */ }
    while (enabled && token && queue.length) {
        const events = takeChunk(keepalive);
        store();
        let retry;
        try {
            const response = await fetch(apiUrl('/api/usage'), {
                method: 'POST',
                keepalive,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Quidey-Platform': platform() },
                body: body(events),
            });
            retry = response.status >= 500;
        } catch {
            retry = true;
        }
        if (retry) {
            // not sent: back in front, and no more tries until the next beat
            if (enabled) { queue = [...events, ...queue].slice(-QUEUE_MAX); store(); }
            return;
        }
    }
}

// Only for tests: as on a fresh start
export function resetUsage() {
    enabled = true;
    setUsageEnabled(false);
    queue = [];
}
