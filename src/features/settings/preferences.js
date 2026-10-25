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
// the swatch shown for each accent (its dark-mode colour) and its name's translation key
export const ACCENT_SWATCHES = [
    { value: 'sunset', label: 'accentSunset', color: '#fb923c' }, // the default
    { value: 'green', label: 'accentGreen', color: '#0ed30e' },
    { value: 'ocean', label: 'accentOcean', color: '#38bdf8' },
    { value: 'violet', label: 'accentViolet', color: '#a78bfa' },
    { value: 'rose', label: 'accentRose', color: '#fb7185' },
    { value: 'gold', label: 'accentGold', color: '#facc15' },
];
export const storeAccent = (accent) => store('accent', accent);

// Colour palettes: the ground the app stands on (backgrounds, surfaces, lines, text), apart from
// the accent. The values live in index.css under [data-palette]; these are the swatches the
// settings show ({ dark, light }: page, card, text), keep them in step.
export const PALETTES = {
    warm: { dark: ['#0e0d0c', '#181716', '#f4f3f1'], light: ['#f5f5f3', '#ffffff', '#151413'] },
    graphite: { dark: ['#0d0e10', '#16181b', '#f3f4f6'], light: ['#f4f5f7', '#ffffff', '#121418'] },
    nord: { dark: ['#0b1018', '#131a25', '#eef2f8'], light: ['#f2f5f9', '#ffffff', '#0f1724'] },
    forest: { dark: ['#0a0f0c', '#121a15', '#eef5f0'], light: ['#f3f6f2', '#ffffff', '#111a14'] },
    plum: { dark: ['#100c12', '#19141c', '#f6f1f7'], light: ['#f7f4f8', '#ffffff', '#17121a'] },
    mono: { dark: ['#000000', '#0f0f0f', '#ffffff'], light: ['#ffffff', '#f3f3f3', '#0a0a0a'] },
};
export const PALETTE_NAMES = Object.keys(PALETTES);
export const DEFAULT_PALETTE = 'warm';
export const readStoredPalette = () => readStored('palette', PALETTE_NAMES, DEFAULT_PALETTE);
export const storePalette = (palette) => store('palette', palette);

// Length of a new session in minutes
export const SESSION_LENGTHS = [15, 25, 30, 45, 60];
export const readStoredSessionMinutes = () =>
    Number(readStored('sessionMinutes', SESSION_LENGTHS.map(String), '30'));
export const storeSessionMinutes = (minutes) => store('sessionMinutes', String(minutes));

// How the focus time is measured: a countdown ("timer") or counting up from zero ("stopwatch")
export const TIMER_MODES = ['timer', 'stopwatch'];
export const readStoredTimerMode = () => readStored('timerMode', TIMER_MODES, 'timer');
export const storeTimerMode = (mode) => store('timerMode', mode);

// Whether Home's task list shows the tasks of my shared sessions among my own (in "All");
// a session's own group still shows them
export const readStoredShowSharedTasks = () => readStored('showSharedTasks', ['0', '1'], '1') === '1';
export const storeShowSharedTasks = (show) => store('showSharedTasks', show ? '1' : '0');

// Whether this account has seen the intro tour on this device (shown once to new users)
const tutorialKey = (username) => `tutorialSeen:${username}`;
export const hasSeenTutorial = (username) => readStored(tutorialKey(username), ['1'], null) === '1';
export const storeTutorialSeen = (username) => store(tutorialKey(username), '1');
