// Leaving the app during a focus round: what counts as "woanders" (somewhere else) and the day's
// tally. Only time with the device in use counts: a phone whose screen goes off or a computer that
// sleeps is not a distraction. Where that can't be told (a phone's browser, the installed web app)
// nothing is counted at all (useFocusAway.js decides where it can).
//
// tally (localStorage focusAway): { day, count, ms, round: { count, ms }, lastRound: { count, ms } | null }
// day = Date#toDateString of the day it belongs to; round = the focus round going on (or the last
// one, until the next starts); lastRound = the round before, for the Pomodoro break's recap.

import { useSyncExternalStore } from 'react';
import { selectTimerInProgress } from '../session/sessionAction';

export const AWAY_MIN_MS = 10 * 1000;      // shorter looks elsewhere don't count
export const NUDGE_AFTER_MS = 20 * 1000;   // one nudge after this long away (where it can be told)
const BEAT_GAP_MS = 3000;                  // a longer gap between beats: the computer slept
const STORE_KEY = 'focusAway';

// A focus round is going on: started (or paused mid-way), and not a Pomodoro break
export const inFocusRound = (state) => {
    const { timerMode, pomodoro } = state.session;
    return selectTimerInProgress(state) && (timerMode !== 'pomodoro' || pomodoro.phase === 'focus');
};

// the background beat while away: only beats that came in time are awake time
export const awakeBeat = (awakeMs, sinceLastMs) => (sinceLastMs <= BEAT_GAP_MS ? awakeMs + sinceLastMs : awakeMs);

export const emptyTally = (day) => ({ day, count: 0, ms: 0, round: { count: 0, ms: 0 }, lastRound: null });

// back in the app: { awakeMs: time away with the device in use, running: the timer ran when I left }
// → { tally, counted }
export function noteReturn(tally, { awakeMs, running }, day) {
    const today = tally?.day === day ? tally : { ...emptyTally(day), round: tally?.round ?? { count: 0, ms: 0 }, lastRound: tally?.lastRound ?? null };
    if (!running || !(awakeMs >= AWAY_MIN_MS)) return { tally: today, counted: false };
    return {
        counted: true,
        tally: {
            ...today,
            count: today.count + 1,
            ms: today.ms + awakeMs,
            round: { count: today.round.count + 1, ms: today.round.ms + awakeMs },
        },
    };
}

// 'start' | 'end' | null between two states
export function roundChange(before, after) {
    const was = inFocusRound(before);
    const is = inFocusRound(after);
    if (!was && is) return 'start';
    if (was && !is) return 'end';
    return null;
}

export const startRound = (tally) => ({ ...tally, round: { count: 0, ms: 0 } });
export const endRound = (tally) => ({ ...tally, lastRound: tally.round });

// ---------- kept on the device ----------
export const today = () => new Date().toDateString();

export function readTally() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
        if (stored && typeof stored === 'object') return { ...emptyTally(stored.day), ...stored };
    } catch { /* nothing kept */ }
    return emptyTally(today());
}

const listeners = new Set();
export function writeTally(tally) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(tally)); } catch { /* full or blocked */ }
    listeners.forEach(listener => listener());
}
export const subscribeTally = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

// today's numbers (zero once the day is over)
export const todaysAway = (tally) => (tally.day === today() ? { count: tally.count, ms: tally.ms } : { count: 0, ms: 0 });

// the tally as it is, in components (stays the same object until it changes)
let cachedRaw;
let cached;
const snapshot = () => {
    let raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch { /* blocked */ }
    if (raw !== cachedRaw || cached === undefined) { cachedRaw = raw; cached = readTally(); }
    return cached;
};
export const useAwayTally = () => useSyncExternalStore(subscribeTally, snapshot, snapshot);
