import { useSyncExternalStore } from 'react';

// The tiny store behind everything that lives outside React and that components follow with
// useSyncExternalStore: a value plus the listeners to tell when it changes.

// Just the listeners, for a store whose value is read from elsewhere (storage, the DOM):
// subscribe() for useSyncExternalStore, notify() after the value changed.
export function createListeners() {
    const listeners = new Set();
    return {
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        notify() {
            listeners.forEach(listener => listener());
        },
    };
}

// A value kept here. set(valueOrUpdater) tells every listener, also when nothing differs (callers
// replace objects, so a changed snapshot is a new one); { silent: true } stores without telling
// (tests that start afresh). use() is the hook: the snapshot is the stored value itself, so it is
// stable until set.
export function createExternalStore(initial) {
    let value = initial;
    const { subscribe, notify } = createListeners();
    const get = () => value;
    return {
        get,
        set(next, { silent = false } = {}) {
            value = typeof next === 'function' ? next(value) : next;
            if (!silent) notify();
        },
        subscribe,
        use: () => useSyncExternalStore(subscribe, get, get),
    };
}
