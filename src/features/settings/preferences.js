// Settings that are remembered in the browser between visits.
// localStorage can throw (private mode, blocked storage), so reads fall back
// to a default and writes fail silently: the setting then only lasts this visit.

function readStored(key, allowed, fallback) {
    try {
        const stored = localStorage.getItem(key);
        return allowed.includes(stored) ? stored : fallback;
    } catch {
        return fallback;
    }
}

function store(key, value) {
    try { localStorage.setItem(key, value); } catch { /* only for this visit */ }
}

export const LANGUAGES = ['de', 'en'];
export const readStoredLanguage = () => readStored('language', LANGUAGES, 'de');
export const storeLanguage = (language) => store('language', language);

// Accent color palettes; the values live in index.css under [data-accent]
export const ACCENTS = ['green', 'ocean', 'violet', 'sunset', 'rose', 'gold'];
export const readStoredAccent = () => readStored('accent', ACCENTS, 'green');
export const storeAccent = (accent) => store('accent', accent);

// Length of a new session in minutes
export const SESSION_LENGTHS = [15, 25, 30, 45, 60];
export const readStoredSessionMinutes = () =>
    Number(readStored('sessionMinutes', SESSION_LENGTHS.map(String), '30'));
export const storeSessionMinutes = (minutes) => store('sessionMinutes', String(minutes));
