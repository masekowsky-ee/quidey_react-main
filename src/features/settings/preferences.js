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
// "Abendrot" (sunset) unless another one was chosen
export const DEFAULT_ACCENT = 'sunset';
export const readStoredAccent = () => readStored('accent', ACCENTS, DEFAULT_ACCENT);
export const storeAccent = (accent) => store('accent', accent);

// Length of a new session in minutes
export const SESSION_LENGTHS = [15, 25, 30, 45, 60];
export const readStoredSessionMinutes = () =>
    Number(readStored('sessionMinutes', SESSION_LENGTHS.map(String), '30'));
export const storeSessionMinutes = (minutes) => store('sessionMinutes', String(minutes));

// How the focus time is measured: a countdown ("timer") or counting up from zero ("stopwatch")
export const TIMER_MODES = ['timer', 'stopwatch'];
export const readStoredTimerMode = () => readStored('timerMode', TIMER_MODES, 'timer');
export const storeTimerMode = (mode) => store('timerMode', mode);

// Whether this account has seen the intro tour on this device (shown once to new users)
const tutorialKey = (username) => `tutorialSeen:${username}`;
export const hasSeenTutorial = (username) => readStored(tutorialKey(username), ['1'], null) === '1';
export const storeTutorialSeen = (username) => store(tutorialKey(username), '1');
