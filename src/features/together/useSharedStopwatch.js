import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { reportSharedActivity, fetchSharedSession } from './togetherAction';

// How often the time worked is sent while running; also the others' view of "working now"
export const REPORT_EVERY_MS = 10 * 1000;
// The server takes at most this much per report. Anything longer means the computer slept,
// and that time shouldn't count as work.
export const MAX_REPORT_MS = 5 * 60 * 1000;

// My stopwatch in a shared session. It counts up on one task at a time and books the time
// on the server in small reports, so the others see it (nearly) live.
// Time is measured with Date.now(), so throttled timers in background tabs don't lose seconds.
// Leaving the page stops it.
//
// Returns { workingOn, start(taskId), stop(), localMs(taskId) }:
// localMs is the time not yet included in the session from the server (unsent + on its way).
export function useSharedStopwatch(sessionId, canWork) {
    const dispatch = useDispatch();
    const [workingOn, setWorkingOn] = useState(null);
    const [, setTick] = useState(0);

    // mutable state read by intervals and unload handlers
    const clock = useRef({ taskId: null, since: 0, inFlight: new Map() });

    // Reports what I'm working on from now (nextTaskId) and books the time since the last report.
    // Never rejects: failures are handled here.
    const report = useCallback((nextTaskId, { keepalive = false } = {}) => {
        const state = clock.current;
        const now = Date.now();
        const bookedTaskId = state.taskId;
        const ms = bookedTaskId ? Math.min(Math.max(0, now - state.since), MAX_REPORT_MS) : 0;

        state.taskId = nextTaskId;
        state.since = now;
        if (ms > 0) state.inFlight.set(bookedTaskId, (state.inFlight.get(bookedTaskId) ?? 0) + ms);
        setWorkingOn(nextTaskId);

        // once the server's totals include these ms, they must not be counted here as well
        let settled = false;
        const settle = () => {
            if (settled) return;
            settled = true;
            if (ms > 0) state.inFlight.set(bookedTaskId, state.inFlight.get(bookedTaskId) - ms);
        };

        return dispatch(reportSharedActivity(sessionId, {
            currentTaskId: nextTaskId,
            time: ms > 0 ? { taskId: bookedTaskId, ms } : undefined,
        }, { keepalive, onBooked: settle }))
            .then(settle)
            .catch((err) => {
                settle();
                if (err.status === 404 || err.status === 409) {
                    // session ended, task removed or I was removed: stop and show what's there now
                    state.taskId = null;
                    setWorkingOn(null);
                    dispatch(fetchSharedSession(sessionId)).catch(() => {});
                } else if (ms > 0 && state.taskId === bookedTaskId) {
                    // offline for a moment: keep the time and send it with the next report
                    state.since -= ms;
                }
            });
    }, [dispatch, sessionId]);

    const start = useCallback((taskId) => {
        if (clock.current.taskId !== taskId) report(taskId);
    }, [report]);

    // resolves once the last seconds are booked
    const stop = useCallback(() => {
        return clock.current.taskId ? report(null) : Promise.resolve();
    }, [report]);

    // ticks the display, and sends a report every REPORT_EVERY_MS while running
    useEffect(() => {
        if (!workingOn) return;
        const interval = setInterval(() => {
            setTick(n => n + 1);
            const state = clock.current;
            if (state.taskId && Date.now() - state.since >= REPORT_EVERY_MS) report(state.taskId);
        }, 1000);
        return () => clearInterval(interval);
    }, [workingOn, report]);

    // ended session or no longer a member: just stop, the server won't take reports anyway
    useEffect(() => {
        if (!canWork && clock.current.taskId) {
            clock.current.taskId = null;
            setWorkingOn(null);
        }
    }, [canWork]);

    // book the last seconds when leaving the page or closing the tab
    useEffect(() => {
        const flush = () => {
            if (clock.current.taskId) report(null, { keepalive: true });
        };
        window.addEventListener('pagehide', flush);
        return () => {
            window.removeEventListener('pagehide', flush);
            flush();
        };
    }, [report]);

    const localMs = (taskId) => {
        const state = clock.current;
        const running = state.taskId === taskId ? Math.min(Date.now() - state.since, MAX_REPORT_MS) : 0;
        return (state.inFlight.get(taskId) ?? 0) + running;
    };

    return { workingOn, start, stop, localMs };
}
