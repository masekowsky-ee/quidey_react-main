import { useEffect } from 'react';
import { createExternalStore } from './externalStore';

// Something fetched once while the app runs and shared by everyone who shows it (the AI's
// allowance, the Untis connection). get() is null until it is known (or when the server couldn't
// be asked); the first load() asks, later ones reuse the answer; refresh() asks again; forget()
// drops it (sign-out). useValue() loads on first use and follows changes.
//
// retryEmpty: an empty (null) answer isn't kept as an answer, the next one who needs it asks again.
export function sharedResource(fetcher, { retryEmpty = false } = {}) {
    const store = createExternalStore(null);
    let loading = null;
    const { get } = store;
    const setValue = (next) => store.set(() => next);

    function load() {
        loading ??= Promise.resolve()
            .then(fetcher)
            .then(answer => {
                const value = answer ?? null;
                if (retryEmpty && value === null) loading = null;
                setValue(value);
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
            loading = null;
            setValue(null);
        },
        // a value known from elsewhere; `loaded` also counts as the answer (null: ask again later)
        set(next, { loaded = false } = {}) {
            if (loaded) loading = next ? Promise.resolve(next) : null;
            setValue(next);
        },
        useValue() {
            useEffect(() => { load(); }, []);
            return store.use();
        },
    };
}
