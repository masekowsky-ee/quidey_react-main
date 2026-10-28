import { SET_SESSION_PARAMS, SAVE_SESSION_DATA, UPDATE_CURRENT_SESSION_DATA, SET_TIMER, ADD_WORKED_TASK, ADD_TASK_TIME, SET_WORKED_SESSIONS, SET_TIMER_MODE, CLOCK_TICK, SET_FOCUS_TASK, SET_POMODORO, RESET_FOCUS } from "./sessionActionTypes";
import { apiFetch } from '../helperFunction';
import { isSharedTaskId, sharedTaskIdOf, selectSharedSoloTasks } from '../together/togetherAction';
import { storeTimerMode, storePomodoro } from '../settings/preferences';
import { playSound } from '../settings/sound';
import { phaseMs } from './sessionReducer';

export const setTimer = (time, active) => {
    return {
        type: SET_TIMER,
        payload: {time: time, active: active},
    }
}


export const setSessionParams = (paramsObj) => {
    return {
        type: SET_SESSION_PARAMS,
        payload: paramsObj,
    }
}

// 'timer' (countdown), 'stopwatch' (up from zero) or 'pomodoro'; remembered for the next visit
export const setTimerMode = (mode) => {
    storeTimerMode(mode);
    return { type: SET_TIMER_MODE, payload: mode };
}

// Pomodoro: { phase?, round?, config? }; new lengths are remembered for the next visit
export const setPomodoro = (change) => (dispatch, getState) => {
    dispatch({ type: SET_POMODORO, payload: change });
    if (change.config) storePomodoro(getState().session.pomodoro.config);
};

// The task to focus on ({ id, name, shared? } or null), on Home and in the Fokusraum alike
export const setFocusTask = (task) => ({
    type: SET_FOCUS_TASK,
    payload: task ? { id: task.id, name: task.name, ...(task.shared ? { shared: task.shared } : {}) } : null,
});

// Whole seconds the running timer moved on (useFocusClock); booked on this task
export const clockTick = (seconds, task) => ({
    type: CLOCK_TICK,
    payload: { seconds, task: task ? { id: task.id, name: task.name } : null },
});

// Sign-out or another account: nothing of the old one's session stays
export const resetFocus = () => ({ type: RESET_FOCUS });

export const selectCurrentSessionData = (state) => state.session.currentSessionData;

// The length the countdown is measured against (a stopwatch has none)
export const selectTimerTotal = (state) => state.session.timerMode === 'pomodoro'
    ? phaseMs(state.session.pomodoro)
    : state.session.sessionParams.time;

// How much of the session has elapsed, as a percentage from 0 to 100 (a stopwatch has no end: 0)
export const selectTimerProgress = (state) => {
    if (state.session.timerMode === 'stopwatch') return 0;
    const total = selectTimerTotal(state);
    if (!total) return 0;
    const elapsed = (total - state.session.timer.time) / total * 100;
    return Math.min(100, Math.max(0, elapsed));
};

// Started and not stopped yet (also paused): the header shows it, the mode can't be switched
export const selectTimerInProgress = (state) => {
    const { timer, timerMode } = state.session;
    if (timer.active) return true;
    if (timerMode === 'stopwatch') return timer.time > 0;
    return timer.time > 0 && timer.time !== selectTimerTotal(state);
};

// The task in focus as it is now: an own one only while it's open (it leaves when it's done or
// gone, ticked off in the calendar or on another device), one from a shared session read live
// (gone when I left the session or it ended)
export const selectFocusTask = (state) => {
    const chosen = state.session.focusTask;
    if (!chosen) return null;
    if (chosen.shared) return selectSharedSoloTasks(state).find(task => task.id === chosen.id) ?? null;
    const own = state.task.tasks.find(task => task.id === chosen.id);
    return own && !own.done ? own : null;
};

export const fetchSessions = () => {
    return async (dispatch) => {
        const sessions = await apiFetch("/api/sessions");
        dispatch({
            type: SET_WORKED_SESSIONS,
            payload: sessions,
        });
    }
}

export const saveSessionData = () => {
    return async (dispatch, getState) => {
        const state = getState();
        const current = selectCurrentSessionData(state);
        const sessionDataObj = {
            ...current,
            group: state.session.sessionParams.group ?? current.group,
            // tasks from shared sessions ("shared-12") are sent by their own id, so they are
            // never mixed up with an own task that has the same number
            workedTasks: current.workedTasks.map(task => isSharedTaskId(task.id)
                ? { sharedTaskId: sharedTaskIdOf(task.id), name: task.name, time: task.time }
                : task),
        };
        const data = await apiFetch(
            `/api/sessions`, {
                method: 'POST',
                body: JSON.stringify(sessionDataObj)
            }
        );

        dispatch({
            type: SAVE_SESSION_DATA,
            payload: data,
        });
    }
}

// The focus time so far is saved, if there is any (a finished countdown, a Pomodoro round)
const saveIfWorked = () => (dispatch, getState) => {
    if (getState().session.currentSessionData.totalTime <= 0) return Promise.resolve();
    return dispatch(saveSessionData()).catch(err => console.error("Saving session failed:", err));
};

// ---------- the alarm on the server ----------
// A phone that is off runs no JavaScript, so the end of a countdown is announced by the server
// as a push notification (when push is on for the device). Fire and forget: without it the
// app still notices the end when it is opened again.
function scheduleAlarm(state) {
    const { timer, timerMode, pomodoro, runningSince } = state.session;
    if (timerMode === 'stopwatch' || !timer.active) return;
    const endsAt = new Date((runningSince ?? Date.now()) + timer.time).toISOString();
    const phase = timerMode === 'pomodoro' ? pomodoro.phase : 'timer';
    apiFetch('/api/focus/alarm', { method: 'PUT', body: JSON.stringify({ endsAt, phase }) }).catch(() => {});
}
function cancelAlarm() {
    apiFetch('/api/focus/alarm', { method: 'DELETE' }).catch(() => {});
}

// ---------- the controls (timer panel, Fokusraum, shortcuts) ----------
export const startFocus = () => (dispatch, getState) => {
    const { timer, timerMode, pomodoro } = getState().session;
    if (timer.active) return;
    if (timerMode !== 'stopwatch' && timer.time < 1000) return;
    dispatch(setTimer(timer.time, true));
    playSound('focusStart');
    const task = selectFocusTask(getState());
    if (task && (timerMode !== 'pomodoro' || pomodoro.phase === 'focus')) dispatch(addWorkedTask(task));
    scheduleAlarm(getState());
};

export const pauseFocus = () => (dispatch, getState) => {
    const { timer } = getState().session;
    if (!timer.active) return;
    playSound('pause');
    dispatch(setTimer(timer.time, false));
    cancelAlarm();
};

// Stop: the session is saved; the countdown stands at zero, the stopwatch and Pomodoro start
// over from the beginning
export const stopFocus = () => (dispatch, getState) => {
    playSound('pause');
    const { timerMode, timer } = getState().session;
    const wasRunning = timer.active;
    if (timerMode === 'pomodoro') {
        dispatch(setTimer(0, false));
        dispatch({ type: SET_POMODORO, payload: { phase: 'focus', round: 0 } });
    } else {
        dispatch(setTimer(0, false));
    }
    if (wasRunning) cancelAlarm();
    return dispatch(saveSessionData()).catch(err => console.error("Saving session failed:", err));
};

// the name of each Pomodoro phase (translation keys)
export const PHASE_LABEL = { focus: 'pomodoroFocus', short: 'pomodoroShort', long: 'pomodoroLong' };

// Pomodoro: what comes after a phase (focus → short break, every n-th → long break, break → focus)
export function nextPhase(pomodoro) {
    if (pomodoro.phase !== 'focus') return { phase: 'focus', round: pomodoro.round };
    const round = pomodoro.round + 1;
    return { phase: round % pomodoro.config.every === 0 ? 'long' : 'short', round };
}

// Skips to the next Pomodoro phase by hand (the focus time so far still counts)
export const skipPhase = () => (dispatch, getState) => {
    const { pomodoro, timer } = getState().session;
    if (timer.active) { dispatch(setTimer(timer.time, false)); cancelAlarm(); }
    if (pomodoro.phase === 'focus') dispatch(saveIfWorked());
    dispatch({ type: SET_POMODORO, payload: nextPhase(pomodoro) });
};

// The countdown ran out (useFocusClock saw it, maybe only now that the phone is on again):
// the sound, the time saved, and in Pomodoro the next phase ready to start.
// Answers which phase just ended ('timer' for a plain countdown).
export const countdownEnded = () => (dispatch, getState) => {
    const { timerMode, pomodoro } = getState().session;
    playSound('focusEnd');
    if (timerMode !== 'pomodoro') {
        dispatch(saveIfWorked());
        return 'timer';
    }
    if (pomodoro.phase === 'focus') dispatch(saveIfWorked());
    dispatch({ type: SET_POMODORO, payload: nextPhase(pomodoro) });
    return pomodoro.phase;
};

export const updateCurrentSessionData = (updateDataObj) => {
    return {
        type: UPDATE_CURRENT_SESSION_DATA,
        payload: updateDataObj,
    }
}

export const addWorkedTask = (task) => {
    return {
        type: ADD_WORKED_TASK,
        payload: {id: task.id, name: task.name},
    }
}

// Books worked time (seconds) on a task in the current session
export const addTaskTime = (task, seconds) => {
    return {
        type: ADD_TASK_TIME,
        payload: {id: task.id, name: task.name, seconds},
    }
}

// Seconds spent on a task in the current session (0 if not worked on yet)
export const selectTaskTime = (state, taskId) =>
    state.session.currentSessionData.workedTasks.find(t => t.id === taskId)?.time ?? 0;
