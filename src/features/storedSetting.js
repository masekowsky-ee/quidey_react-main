import { useSyncExternalStore } from 'react';
import { createListeners } from './externalStore';

// The one way settings are kept on this device (localStorage). Storage can throw (private mode,
// blocked or full), so a read falls back to a default and a write fails silently: the setting then
// only lasts this visit.

// The stored text (null when there is none) as a value: with `allowed`, the text if it is one of
// them, else `fallback`; with `parse`, whatever parse(text) gives; neither: the text. Anything
// that throws (storage or parse) gives `fallback`.
export function read(key, { allowed, fallback, parse } = {}) {
    try {
        const stored = localStorage.getItem(key);
        if (allowed) return allowed.includes(stored) ? stored : fallback;
        return parse ? parse(stored) : stored;
    } catch {
        return fallback;
    }
}

export function write(key, text) {
    try { localStorage.setItem(key, text); } catch { /* only for this visit */ }
}

export function remove(key) {
    try { localStorage.removeItem(key); } catch { /* nothing stored */ }
}

// A stored value that components follow (useSyncExternalStore): get/set it, and every hook
// re-reads after a set. `encode` turns the value into the stored text.
export function createStoredValue(key, { fallback, parse, encode }) {
    const { subscribe, notify } = createListeners();
    const get = () => read(key, { fallback, parse });
    return {
        get,
        set(value) {
            write(key, encode(value));
            notify();
        },
        useValue: () => useSyncExternalStore(subscribe, get, get),
    };
}
