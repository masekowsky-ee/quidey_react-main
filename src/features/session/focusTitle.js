// The running focus timer in the browser tab's title ("▶ 24:13 · Essay"), so it can be seen from
// other tabs. Only while it runs (paused or stopped the title goes back), only in the browser (the
// Android app has its lasting notification instead), and never while the team stopwatch
// (together/work.js) shows its own clock there. Mounted once in App (useFocusTitle).
//
// The time is worked out from the wall clock (runningSince), not from the store's last tick, and
// the beat comes from a worker (titleTick.worker.js): in a background tab the page's own timers
// are slowed down to once a minute, a worker's are not.

import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { isNativeApp } from '../native/native';
import { translate } from '../../i18n/useTranslation';
import { selectFocusTask, PHASE_LABEL } from './sessionAction';
import { clockText } from './focusNotification';

// The title for `now`, or null while nothing runs
export function focusTitle(state, language, now) {
    const { timer, timerMode, pomodoro, runningSince } = state.session;
    if (!timer.active || runningSince == null) return null;
    const stopwatch = timerMode === 'stopwatch';
    const since = Math.max(0, now - runningSince);
    // a countdown shows the second it is in (24:59.4 left → 25:00), so it reaches 0:00 at the end
    const ms = stopwatch ? timer.time + since : Math.ceil(Math.max(0, timer.time - since) / 1000) * 1000;
    const onBreak = timerMode === 'pomodoro' && pomodoro.phase !== 'focus';
    const label = onBreak
        ? translate(language, PHASE_LABEL[pomodoro.phase])
        : selectFocusTask(state)?.name ?? translate(language, PHASE_LABEL.focus);
    return `▶ ${clockText(Math.floor(ms / 1000) * 1000)} · ${label}`;
}

// calls onBeat twice a second; returns the stop
function startBeat(onBeat) {
    if (typeof Worker !== 'undefined') {
        try {
            const worker = new Worker(new URL('./titleTick.worker.js', import.meta.url), { type: 'module' });
            worker.onmessage = onBeat;
            return () => worker.terminate();
        } catch { /* no worker here: the page's own timer below */ }
    }
    const interval = setInterval(onBeat, 500);
    return () => clearInterval(interval);
}

export function useFocusTitle(enabled) {
    const store = useStore();
    useEffect(() => {
        if (!enabled || isNativeApp() || typeof document === 'undefined') return undefined;
        let original = null; // the title before ours, while ours is shown
        let stopBeat = null;
        const write = () => {
            const state = store.getState();
            // the team stopwatch has the title: leave it (and the title to go back to) alone
            if (state.together?.work?.taskId) {
                if (stopBeat) { stopBeat(); stopBeat = null; }
                return;
            }
            const title = focusTitle(state, state.settings.language, Date.now());
            if (title) {
                if (original === null) original = document.title;
                if (document.title !== title) document.title = title;
                if (!stopBeat) stopBeat = startBeat(write);
            } else {
                if (original !== null) { document.title = original; original = null; }
                if (stopBeat) { stopBeat(); stopBeat = null; }
            }
        };
        write();
        const unsubscribe = store.subscribe(write);
        return () => {
            unsubscribe();
            stopBeat?.();
            if (original !== null) document.title = original;
        };
    }, [enabled, store]);
}
