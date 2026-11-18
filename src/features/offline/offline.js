// Offline-first for the API: every answer the app reads is kept on the device, and the changes a
// person makes without a connection wait in a queue (the outbox) until it is back.
//
//  - Reads (GET /api/...): the network answer is saved; when the server can't be reached the
//    saved one is returned instead, and the app is "offline" until a request gets through.
//  - Writes: only the ones listed in WRITES (tasks, groups of a task, focus sessions). Offline
//    they get an answer made here (a temporary id for new things) and go to the outbox, with an
//    Idempotency-Key so a retry never makes a second one. Back online the outbox is sent in
//    order; temporary ids in later entries are swapped for the real ones.
//  - Everything else fails with code OFFLINE while there is no connection.
//
// The copy belongs to one account: it is cleared on sign-out and never read by another account.
import { kvGet, kvSet, kvDelete, kvKeys, kvClear } from './storage';

export const CONNECTION_EVENT = 'quidey:connection';
export const SYNCED_EVENT = 'quidey:synced';

// not kept offline: sign-in flows, money, the admin panel and the AI (needs the server anyway)
const NEVER_CACHED = ['/api/auth/', '/api/billing', '/api/admin', '/api/ai/', '/api/assistant', '/api/push', '/api/usage'];
const CACHE_PREFIX = 'get:';
const OUTBOX_KEY = 'outbox';
const ID_MAP_KEY = 'idmap';
// an offline copy older than this is not shown any more (a very old list is worse than none)
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;
// a read that takes longer than this is answered from the saved copy, when there is one
export const SLOW_MS = 8000;
// ... and a read that still has no answer after this long is cancelled: a connection that leads
// nowhere would otherwise keep one of the few connections per host busy (a phone allows six),
// and the outbox's request would wait in line behind such reads for minutes
export const HARD_MS = 20000;
// without a saved copy the person has nothing to look at meanwhile, so it waits longer
export const NO_COPY_MS = 60000;
// a change that gets no answer for this long is kept in the outbox instead (a connection that
// is there but leads nowhere never says no)
export const WRITE_TIMEOUT_MS = 10000;

let status = { offline: false, pending: 0, failed: 0 };
let send = null; // the real request function, handed over by apiFetch
let flushing = null;

export const connectionState = () => status;

function setStatus(change) {
    const next = { ...status, ...change };
    if (next.offline === status.offline && next.pending === status.pending && next.failed === status.failed) return;
    status = next;
    window.dispatchEvent(new CustomEvent(CONNECTION_EVENT, { detail: status }));
}

// ---------- who the copy belongs to ----------

// the account id inside the JWT (not checked here, only to keep accounts apart on one device)
export function tokenOwner(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return String(payload.userId ?? payload.id ?? payload.sub ?? '');
    } catch {
        return '';
    }
}
const owner = () => tokenOwner(localStorage.getItem('token') ?? '') || localStorage.getItem('token')?.slice(-12) || 'guest';
const cacheKey = (url) => `${CACHE_PREFIX}${owner()}|${url}`;
const outboxKey = () => `${OUTBOX_KEY}:${owner()}`;
const idMapKey = () => `${ID_MAP_KEY}:${owner()}`;

// ---------- errors ----------

// The server couldn't be reached: no connection (fetch throws a TypeError) or a gateway that
// has nobody behind it (502-504, e.g. while the API restarts).
export const isUnreachable = (error) => (error instanceof TypeError && error.status === undefined)
    || error?.name === 'AbortError'
    || [502, 503, 504].includes(error?.status);

function offlineError() {
    const error = new Error('You are offline');
    error.status = 0;
    error.code = 'OFFLINE';
    return error;
}

export const isCacheable = (url) => url.startsWith('/api/') && !NEVER_CACHED.some((prefix) => url.startsWith(prefix));

// ---------- reads ----------

async function saveRead(url, data) {
    await kvSet(cacheKey(url), { at: Date.now(), data });
    // keep the copy small: the oldest entries of this account go first
    const keys = await kvKeys(`${CACHE_PREFIX}${owner()}|`);
    if (keys.length <= MAX_ENTRIES) return;
    const entries = await Promise.all(keys.map(async (key) => [key, (await kvGet(key))?.at ?? 0]));
    entries.sort((a, b) => a[1] - b[1]);
    await Promise.all(entries.slice(0, keys.length - MAX_ENTRIES).map(([key]) => kvDelete(key)));
}

async function savedRead(url) {
    const entry = await kvGet(cacheKey(url));
    if (!entry || Date.now() - entry.at > MAX_AGE_MS) return undefined;
    return entry;
}

// For the few requests that don't go through apiFetch (the check at start): keep an answer for
// this account, and read it back when the server can't be reached.
export const saveAnswer = (url, data) => saveRead(url, data).catch(() => {});
export async function savedAnswer(url) {
    return (await savedRead(url))?.data;
}

// ---------- the writes that work offline ----------

const ID = '([^/?]+)';
export const WRITES = [
    { name: 'task:add', method: 'POST', pattern: /^\/api\/tasks$/, creates: true },
    { name: 'task:edit', method: 'PUT', pattern: new RegExp(`^/api/tasks/${ID}$`) },
    { name: 'task:delete', method: 'DELETE', pattern: new RegExp(`^/api/tasks/${ID}(\\?.*)?$`) },
    { name: 'task:group-add', method: 'POST', pattern: new RegExp(`^/api/tasks/${ID}/groups/${ID}$`) },
    { name: 'task:group-remove', method: 'DELETE', pattern: new RegExp(`^/api/tasks/${ID}/groups/${ID}$`) },
    { name: 'session:save', method: 'POST', pattern: /^\/api\/sessions$/, creates: true },
];

export function matchWrite(url, method = 'GET') {
    const m = method.toUpperCase();
    return WRITES.find((write) => write.method === m && write.pattern.test(url));
}

const TEMP = /^local-/;
export const isTempId = (id) => typeof id === 'string' && TEMP.test(id);
let tempCounter = 0;
const tempId = () => `local-${Date.now().toString(36)}${(tempCounter++).toString(36)}`;
const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function parseBody(options) {
    try { return options.body ? JSON.parse(options.body) : {}; } catch { return {}; }
}

// The answer the app gets for a write that only went to the outbox. It carries what the server
// would send back, as far as the app uses it; the truth follows when the outbox is sent.
function localAnswer(write, url, options, id) {
    const body = parseBody(options);
    const now = new Date().toISOString();
    switch (write.name) {
        case 'task:add':
            return { done: false, completed_at: null, created_at: now, isOwner: true, group_ids: [], ...body, id, pending: true };
        case 'task:edit': {
            const done = body.done === true;
            return { ...body, id: body.id ?? url.match(write.pattern)[1], ...(done ? { completed_at: now } : {}), pending: true };
        }
        case 'task:delete':
            return { deletedIds: [url.match(write.pattern)[1]] };
        case 'session:save':
            return { ...body, id, pending: true };
        default:
            return {};
    }
}

// the saved lists change with the write, so a restart while offline still shows it
async function applyToSavedLists(write, url, answer) {
    const listKey = cacheKey('/api/tasks');
    const saved = await kvGet(listKey);
    const sessionsKey = cacheKey('/api/sessions');
    if (write.name === 'session:save') {
        const sessions = await kvGet(sessionsKey);
        if (sessions && Array.isArray(sessions.data)) await kvSet(sessionsKey, { ...sessions, data: [answer, ...sessions.data] });
        return;
    }
    if (!saved || !Array.isArray(saved.data)) return;
    const idOf = (task) => String(task.id);
    let data = saved.data;
    if (write.name === 'task:add') data = [...data, answer];
    else if (write.name === 'task:edit') data = data.map((task) => (idOf(task) === String(answer.id) ? { ...task, ...answer } : task));
    else if (write.name === 'task:delete') data = data.filter((task) => !answer.deletedIds.map(String).includes(idOf(task)));
    else return;
    await kvSet(listKey, { ...saved, data });
}

async function readOutbox() {
    return (await kvGet(outboxKey())) ?? [];
}
async function writeOutbox(list) {
    await kvSet(outboxKey(), list);
    setStatus({ pending: list.length });
}

// the real request, given up after `ms` (the result counts as "server unreachable")
function timed(url, options, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return send(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function enqueue(write, url, options, key) {
    const id = write.creates ? tempId() : null;
    const answer = localAnswer(write, url, options, id);
    const op = { key: key ?? newKey(), name: write.name, method: options.method.toUpperCase(), url, body: options.body ?? null, tempId: id, at: Date.now() };
    await writeOutbox([...(await readOutbox()), op]);
    await applyToSavedLists(write, url, answer);
    return answer;
}

// ---------- sending the outbox ----------

const swapIds = (text, map) => {
    if (!text) return text;
    let result = text;
    for (const [temp, real] of Object.entries(map)) {
        // "local-x" as a JSON string becomes the real (number) id, inside a path just its digits
        result = result.split(`"${temp}"`).join(JSON.stringify(real)).split(temp).join(String(real));
    }
    return result;
};

// Sends what waited. Resolves with how many were sent. Stops at the first one the server can't
// be reached for (kept, tried again later); one the server refuses for good (4xx) is dropped.
export function flushOutbox() {
    if (flushing) return flushing;
    flushing = (async () => {
        if (!send) return 0;
        let queue = await readOutbox();
        if (queue.length === 0) return 0;
        const map = (await kvGet(idMapKey())) ?? {};
        let sent = 0;
        let failed = 0;
        while (queue.length > 0) {
            const op = queue[0];
            const url = swapIds(op.url, map);
            const body = swapIds(op.body, map);
            try {
                const answer = await timed(url, { method: op.method, body: body ?? undefined, headers: { 'Idempotency-Key': op.key } }, WRITE_TIMEOUT_MS);
                if (op.tempId && answer?.id !== undefined) map[op.tempId] = answer.id;
                sent += 1;
            } catch (error) {
                // the server is busy with this very request (an earlier try got through slowly): later
                if (error.code === 'IDEMPOTENCY_IN_PROGRESS') break;
                if (isUnreachable(error)) { setStatus({ offline: true }); break; }
                // gone already (deleted elsewhere) or refused: nothing more to do with it
                if (!(op.method === 'DELETE' && error.status === 404)) failed += 1;
            }
            queue = queue.slice(1);
            await kvSet(idMapKey(), map);
            await writeOutbox(queue);
        }
        // the map stays (trimmed): the app may still hold a temporary id until its lists reload
        const ids = Object.keys(map);
        if (ids.length > 200) for (const old of ids.slice(0, ids.length - 200)) delete map[old];
        await kvSet(idMapKey(), map);
        if (failed > 0) setStatus({ failed: status.failed + failed });
        if (sent > 0 || failed > 0) window.dispatchEvent(new CustomEvent(SYNCED_EVENT, { detail: { sent, failed } }));
        return sent;
    })().finally(() => { flushing = null; });
    return flushing;
}

export const acknowledgeFailures = () => setStatus({ failed: 0 });

// ---------- the one entry point apiFetch uses ----------

export async function withOffline(url, options, request) {
    send = request;
    const method = (options.method ?? 'GET').toUpperCase();

    // something made offline is still called by its temporary id here: use the real one if it has one
    if (url.includes('local-') || (typeof options.body === 'string' && options.body.includes('local-'))) {
        const map = (await kvGet(idMapKey())) ?? {};
        url = swapIds(url, map);
        if (typeof options.body === 'string') options = { ...options, body: swapIds(options.body, map) };
    }

    if (method === 'GET') {
        if (!isCacheable(url)) {
            try {
                return await request(url, options);
            } catch (error) {
                if (!isUnreachable(error)) throw error;
                setStatus({ offline: true });
                throw offlineError();
            }
        }
        const entry = await savedRead(url);
        // a read that takes too long is cancelled (sooner when there is a saved copy to show)
        const controller = options.signal ? null : new AbortController();
        const live = request(url, controller ? { ...options, signal: controller.signal } : options).then((data) => {
            setStatus({ offline: false });
            saveRead(url, data).catch(() => {});
            if (status.pending > 0) flushOutbox().catch(() => {});
            return data;
        });
        const hard = controller ? setTimeout(() => controller.abort(), entry ? HARD_MS : NO_COPY_MS) : null;
        // an answer nobody waits for any more must not end as an unhandled rejection
        live.finally(() => clearTimeout(hard)).catch(() => {});
        let timer;
        try {
            // a bad connection (it answers, but slowly) shows the saved copy after a while instead
            // of a page that waits; the answer, when it comes, refreshes the copy
            return await (entry ? Promise.race([live, new Promise((resolve) => { timer = setTimeout(() => resolve(entry.data), SLOW_MS); })]) : live);
        } catch (error) {
            if (!isUnreachable(error)) throw error;
            setStatus({ offline: true });
            if (entry) return entry.data;
            throw offlineError();
        } finally {
            clearTimeout(timer);
        }
    }

    const write = matchWrite(url, method);
    // a new thing carries its key from the first try on: if that try reached the server but its
    // answer got lost, sending it again from the outbox can't make a second one
    const key = write?.creates ? newKey() : null;
    // a change made while earlier ones still wait goes behind them (the order matters): try to
    // send those first, and queue this one if they are still there
    if (write && (await readOutbox()).length > 0) {
        await flushOutbox().catch(() => {});
        if ((await readOutbox()).length > 0) return enqueue(write, url, { ...options, method }, key);
    }
    try {
        const data = write
            ? await timed(url, { ...options, headers: { ...options.headers, ...(key ? { 'Idempotency-Key': key } : {}) } }, WRITE_TIMEOUT_MS)
            : await request(url, options);
        setStatus({ offline: false });
        return data;
    } catch (error) {
        if (!isUnreachable(error)) throw error;
        setStatus({ offline: true });
        if (!write) throw offlineError();
        return enqueue(write, url, { ...options, method }, key);
    }
}

// ---------- housekeeping ----------

// everything of this device's offline copy (sign-out)
export async function clearOffline() {
    await kvClear();
    status = { offline: false, pending: 0, failed: 0 };
    window.dispatchEvent(new CustomEvent(CONNECTION_EVENT, { detail: status }));
}

// This account's saved reads (sign-out). Changes still waiting in the outbox stay, so they are
// not lost: they go out the next time this account is signed in here.
export async function forgetReads() {
    const keys = await kvKeys(`${CACHE_PREFIX}${owner()}|`);
    await Promise.all(keys.map((key) => kvDelete(key)));
}

export async function loadPending() {
    setStatus({ pending: (await readOutbox()).length });
}

// when the connection is back, or the app is opened again, the outbox goes out
export function startOfflineSync() {
    const run = () => { flushOutbox().catch(() => {}); };
    window.addEventListener('online', run);
    window.addEventListener('focus', run);
    window.addEventListener('offline', () => setStatus({ offline: true }));
    const timer = setInterval(() => { if (status.pending > 0) run(); }, 30_000);
    loadPending().then(() => { if (status.pending > 0) run(); });
    return () => {
        window.removeEventListener('online', run);
        window.removeEventListener('focus', run);
        clearInterval(timer);
    };
}
