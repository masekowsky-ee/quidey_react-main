import { useEffect, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { WORK_SWITCHED, WORK_SETTLED, WORK_RESTORED, WORK_STOPPED } from './togetherActionTypes';
import { reportSharedActivity, fetchSharedSession, timeOf } from './togetherAction';
import { formatClock } from '../helperFunction';

// My team stopwatch. It counts up on one task of one session at a time and books the time
// on the server in small reports, so the others see it (nearly) live. It lives in the store
// and runs app-wide; useWorkReporter (mounted once in App) sends the reports.
// Time is measured with Date.now(), so throttled timers in background tabs don't lose seconds.

// How often the time worked is sent while running; also the others' view of "working now"
export const REPORT_EVERY_MS = 10 * 1000;
// The server takes at most this much per report. Anything longer means the computer slept,
// and that time shouldn't count as work.
export const MAX_REPORT_MS = 5 * 60 * 1000;

const runningMs = (work, now) => work.taskId ? Math.min(Math.max(0, now - work.since), MAX_REPORT_MS) : 0;

// One report to one session. Never rejects: failures are handled here.
const report = (sessionId, body, booked, keepalive) => (dispatch) => {
    // runs right before the new totals are stored, so the time is never counted twice
    let settled = false;
    const settle = () => {
        if (settled || !booked) return;
        settled = true;
        dispatch({ type: WORK_SETTLED, payload: booked });
    };
    return dispatch(reportSharedActivity(sessionId, body, { keepalive, onBooked: settle }))
        .then(settle)
        .catch((err) => {
            settle();
            if (err.status === 404 || err.status === 409) {
                // session ended, task removed or I was removed: stop, and show what's there now
                dispatch({ type: WORK_STOPPED, payload: sessionId });
                dispatch(fetchSharedSession(sessionId)).catch(() => {});
            } else if (booked) {
                // offline for a moment: keep the time and send it with the next report
                dispatch({ type: WORK_RESTORED, payload: booked });
            }
        });
};

// Work on `next` from now on: { sessionId, sessionName, taskId, taskName, baseMs }, or null to stop.
// Books the time since the last report. Resolves once the reports are answered.
export const switchWork = (next, { keepalive = false } = {}) => (dispatch, getState) => {
    const work = getState().together.work;
    const now = Date.now();
    const ms = runningMs(work, now);
    const booked = ms > 0 ? { taskId: work.taskId, ms } : null;
    const time = booked ? { taskId: booked.taskId, ms: booked.ms } : undefined;

    dispatch({ type: WORK_SWITCHED, payload: { next, booked, now } });

    const sameSession = next && work.sessionId === next.sessionId;
    if (sameSession || !work.sessionId) {
        return next ? dispatch(report(next.sessionId, { currentTaskId: next.taskId, time }, booked, keepalive)) : Promise.resolve();
    }
    // moving to another session (or stopping): finish in the old one first
    const finished = dispatch(report(work.sessionId, { currentTaskId: null, time }, booked, keepalive));
    if (!next) return finished;
    return Promise.all([finished, dispatch(report(next.sessionId, { currentTaskId: next.taskId }, null, keepalive))]);
};

// Start working on a task of a session (as GET /api/shared-sessions/:id returns them)
export const startWork = (session, task) => (dispatch, getState) => {
    const work = getState().together.work;
    if (work.sessionId === session.id && work.taskId === task.id) return Promise.resolve();
    return dispatch(switchWork({
        sessionId: session.id,
        sessionName: session.name,
        taskId: task.id,
        taskName: task.name,
        // myMs when the task comes from the solo view, which knows my time but not everybody's
        baseMs: task.myMs ?? timeOf(task, session.me),
    }));
};

export const stopWork = (options) => (dispatch, getState) =>
    getState().together.work.taskId ? dispatch(switchWork(null, options)) : Promise.resolve();

// Sends a report when REPORT_EVERY_MS have passed
export const tickWork = () => (dispatch, getState) => {
    const work = getState().together.work;
    if (work.taskId && Date.now() - work.since >= REPORT_EVERY_MS) return dispatch(switchWork({ ...work }));
};

export const selectWork = (state) => state.together.work;

// My time on a task that the session data from the server doesn't include yet
export function localMs(work, taskId, now) {
    return (work.inFlight[taskId] ?? 0) + (work.taskId === taskId ? runningMs(work, now) : 0);
}

// My total on the task I'm working on (for the header, which may not have the session loaded)
export function workTotalMs(work, now) {
    return work.baseMs + work.workedMs + runningMs(work, now);
}

// Current time, updated every `everyMs` while `active`
export function useNow(active = true, everyMs = 1000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return;
        const interval = setInterval(() => setNow(Date.now()), everyMs);
        return () => clearInterval(interval);
    }, [active, everyMs]);
    // while inactive the last value is fine: nothing is running that it would measure
    return now;
}

// Mounted once (App): sends the regular reports, books the last seconds when the tab closes,
// and shows the running clock in the browser tab title.
export function useWorkReporter() {
    const dispatch = useDispatch();
    const work = useSelector(selectWork);
    const running = Boolean(work.taskId);

    useEffect(() => {
        if (!running) return;
        const interval = setInterval(() => dispatch(tickWork()), 1000);
        return () => clearInterval(interval);
    }, [running, dispatch]);

    useEffect(() => {
        const flush = () => dispatch(stopWork({ keepalive: true }));
        window.addEventListener('pagehide', flush);
        return () => window.removeEventListener('pagehide', flush);
    }, [dispatch]);

    // "▶ 00:12:03 · Slides" in the tab, so the timer is visible from other tabs too.
    // Reads the store directly, so the interval isn't restarted by every report.
    const store = useStore();
    useEffect(() => {
        if (!running) return;
        const original = document.title;
        const update = () => {
            const latest = store.getState().together.work;
            if (latest.taskId) document.title = `▶ ${formatClock(workTotalMs(latest, Date.now()))} · ${latest.taskName}`;
        };
        update();
        const interval = setInterval(update, 1000);
        return () => {
            clearInterval(interval);
            document.title = original;
        };
    }, [running, store]);
}
