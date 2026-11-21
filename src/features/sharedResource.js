import { useEffect, useSyncExternalStore } from 'react';

// Something fetched once while the app runs and shared by everyone who shows it (the AI's
// allowance, the Untis connection). get() is null until it is known (or when the server couldn't
// be asked); the first load() asks, later ones reuse the answer; refresh() asks again; forget()
// drops it (sign-out). useValue() loads on first use and follows changes.
//
// retryEmpty: an empty (null) answer isn't kept as an answer, the next one who needs it asks again.
export function sharedResource(fetcher, { retryEmpty = false } = {}) {
    let value = null;
    let loading = null;
    const listeners = new Set();
    const notify = () => listeners.forEach(listener => listener());
    const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
    const get = () => value;

    function load() {
        loading ??= Promise.resolve()
            .then(fetcher)
            .then(answer => {
                value = answer ?? null;
                if (retryEmpty && value === null) loading = null;
                notify();
                return value;
            })
            .catch(() => { loading = null; return null; });
        return loading;
    }

    return {
        get,
        load,
        refresh() {
            loading = null;
            return load();
        },
        forget() {
            value = null;
            loading = null;
            notify();
        },
        // a value known from elsewhere; `loaded` also counts as the answer (null: ask again later)
        set(next, { loaded = false } = {}) {
            value = next;
            if (loaded) loading = next ? Promise.resolve(next) : null;
            notify();
        },
        useValue() {
            useEffect(() => { load(); }, []);
            return useSyncExternalStore(subscribe, get, get);
        },
    };
}
