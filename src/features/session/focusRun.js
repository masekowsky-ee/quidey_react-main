// The running focus session on this device (localStorage `focusRun`), so it survives what a phone
// does to an installed app: the screen goes off and the app is frozen, or it is closed and opened
// again later. The timer itself never counts ticks: it keeps the wall-clock moment it was last
// brought up to date (`runningSince`) and catches up from there (see useFocusClock), so the time
// that passed while nothing ran is counted all the same.
//
// Stored: mode, timer, session length, the Pomodoro phase, the task in focus and the time booked
// so far. Thrown away after FOCUS_RUN_MAX_AGE (an old run is no use) and on sign-out.

const KEY = 'focusRun';
// a session left alone for longer than this is not taken up again
export const FOCUS_RUN_MAX_AGE = 18 * 60 * 60 * 1000;

const FIELDS = ['timerMode', 'timer', 'runningSince', 'sessionParams', 'pomodoro', 'focusTask', 'focusPicked', 'currentSessionData'];

export function readFocusRun(now = Date.now()) {
    try {
        const run = JSON.parse(localStorage.getItem(KEY) ?? 'null');
        if (!run || typeof run !== 'object' || typeof run.savedAt !== 'number') return null;
        if (now - run.savedAt > FOCUS_RUN_MAX_AGE) return null;
        if (!run.timer || typeof run.timer.time !== 'number') return null;
        return Object.fromEntries(FIELDS.filter(field => field in run).map(field => [field, run[field]]));
    } catch {
        return null;
    }
}

// Only worth storing while something is going on: started, paused mid-way, or time booked
export function storeFocusRun(session, now = Date.now()) {
    if (frozen) return;
    try {
        const idle = !session.timer.active && !session.currentSessionData.totalTime && !session.focusTask
            && (session.pomodoro?.round ?? 0) === 0;
        if (idle) { localStorage.removeItem(KEY); return; }
        const run = Object.fromEntries(FIELDS.map(field => [field, session[field]]));
        localStorage.setItem(KEY, JSON.stringify({ ...run, savedAt: now }));
    } catch { /* only for this visit */ }
}

// freeze: the page is about to reload as another account, nothing may be written any more
let frozen = false;
export function clearFocusRun({ freeze = false } = {}) {
    if (freeze) frozen = true;
    try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
}

// Keeps the stored run in step with the store (written at most a few times a second)
export function persistFocusRun(store) {
    let last = store.getState().session;
    let pending = null;
    return store.subscribe(() => {
        const session = store.getState().session;
        if (session === last) return;
        last = session;
        if (pending) return;
        pending = setTimeout(() => { pending = null; storeFocusRun(store.getState().session); }, 250);
    });
}
