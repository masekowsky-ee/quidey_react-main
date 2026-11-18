// A small key-value store for the offline copy of the app's data (IndexedDB, so it holds more than
// localStorage's few MB and doesn't block the page). Where IndexedDB isn't there (tests, some
// private modes) a plain in-memory map stands in: the app then works as before, only without an
// offline copy that survives a restart.
const DB_NAME = 'quidey-offline';
const STORE = 'kv';

const memory = new Map();
let dbPromise = null;

function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
        try {
            if (typeof indexedDB === 'undefined') return resolve(null);
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(STORE);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
    return dbPromise;
}

// one transaction, resolved with the request's result (null if anything goes wrong)
async function run(mode, work) {
    const db = await openDb();
    if (!db) return undefined;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE, mode);
            const request = work(tx.objectStore(STORE));
            tx.oncomplete = () => resolve(request?.result);
            tx.onerror = () => resolve(undefined);
            tx.onabort = () => resolve(undefined);
        } catch {
            resolve(undefined);
        }
    });
}

export async function kvGet(key) {
    const db = await openDb();
    if (!db) return memory.get(key);
    return run('readonly', (store) => store.get(key));
}

export async function kvSet(key, value) {
    const db = await openDb();
    if (!db) { memory.set(key, value); return; }
    await run('readwrite', (store) => store.put(value, key));
}

export async function kvDelete(key) {
    const db = await openDb();
    if (!db) { memory.delete(key); return; }
    await run('readwrite', (store) => store.delete(key));
}

export async function kvKeys(prefix = '') {
    const db = await openDb();
    if (!db) return [...memory.keys()].filter((key) => key.startsWith(prefix));
    const keys = await run('readonly', (store) => store.getAllKeys());
    return (keys ?? []).filter((key) => typeof key === 'string' && key.startsWith(prefix));
}

// everything of the offline copy (sign-out, switching the account)
export async function kvClear() {
    const db = await openDb();
    if (!db) { memory.clear(); return; }
    await run('readwrite', (store) => store.clear());
}
