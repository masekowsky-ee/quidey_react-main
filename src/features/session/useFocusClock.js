import { useEffect } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { clockTick, countdownEnded, selectFocusTask } from './sessionAction';
import { storeFocusRun } from './focusRun';
import { showToast } from '../toast/toast';
import { translate } from '../../i18n/useTranslation';
import { fill } from '../helperFunction';

// The clock behind the focus timer. It never counts its own ticks: every quarter second, and
// right when the app comes back (screen on again, tab shown, app reopened), it looks at the wall
// clock and moves the timer on by the whole seconds since `runningSince`. A phone that froze the
// app for ten minutes therefore shows the right time the moment it is unlocked, and those ten
// minutes are booked on the task in focus. A countdown that ran out meanwhile ends then.
//
// Mounted in the app shell (so the timer runs on every page) and in the timer panel; when more
// than one is mounted only one of them counts.

const TICK_MS = 250;
let owner = null;

const ENDED_TEXT = { timer: 'focusEndedTimer', focus: 'focusEndedFocus', short: 'focusEndedBreak', long: 'focusEndedBreak' };

export function useFocusClock() {
    const store = useStore();
    const dispatch = useDispatch();

    useEffect(() => {
        const me = Symbol('focus clock');
        const tick = () => {
            if (owner && owner !== me) return;
            owner = me;
            const state = store.getState();
            const { timer, runningSince, timerMode } = state.session;
            if (!timer.active || runningSince == null) return;
            const passed = Math.floor((Date.now() - runningSince) / 1000);
            if (passed < 1) return;
            const seconds = timerMode === 'stopwatch' ? passed : Math.min(passed, Math.ceil(timer.time / 1000));
            dispatch(clockTick(seconds, selectFocusTask(state)));
            if (store.getState().session.timer.active) return;
            // the countdown is over
            const ended = dispatch(countdownEnded());
            const after = store.getState();
            const language = after.settings.language;
            const next = after.session.pomodoro;
            const text = fill(translate(language, ENDED_TEXT[ended] ?? 'focusEndedTimer'),
                { minutes: next.config[next.phase], round: next.round });
            dispatch(showToast(text, 'success', { to: '/focus' }));
        };
        const wake = () => {
            tick();
            // the app may be frozen or closed any moment now: the run is written down at once
            if (document.visibilityState === 'hidden') storeFocusRun(store.getState().session);
        };
        const id = setInterval(tick, TICK_MS);
        document.addEventListener('visibilitychange', wake);
        window.addEventListener('focus', wake);
        window.addEventListener('pageshow', wake);
        window.addEventListener('pagehide', wake);
        tick();
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', wake);
            window.removeEventListener('focus', wake);
            window.removeEventListener('pageshow', wake);
            window.removeEventListener('pagehide', wake);
            if (owner === me) owner = null;
        };
    }, [store, dispatch]);
}
