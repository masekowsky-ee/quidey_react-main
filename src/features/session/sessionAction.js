import { SET_SESSION_PARAMS, SAVE_SESSION_DATA, UPDATE_CURRENT_SESSION_DATA, SET_TIMER, ADD_WORKED_TASK, ADD_TASK_TIME, SET_WORKED_SESSIONS, SET_TIMER_MODE } from "./sessionActionTypes";
import { apiFetch } from '../helperFunction';
import { isSharedTaskId, sharedTaskIdOf } from '../together/togetherAction';
import { storeTimerMode } from '../settings/preferences';

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

// 'timer' (countdown) or 'stopwatch' (up from zero); remembered for the next visit
export const setTimerMode = (mode) => {
    storeTimerMode(mode);
    return { type: SET_TIMER_MODE, payload: mode };
}

export const selectCurrentSessionData = (state) => state.session.currentSessionData;

// How much of the session has elapsed, as a percentage from 0 to 100 (a stopwatch has no end: 0)
export const selectTimerProgress = (state) => {
    if (state.session.timerMode === 'stopwatch') return 0;
    const total = state.session.sessionParams.time;
    if (!total) return 0;
    const elapsed = (total - state.session.timer.time) / total * 100;
    return Math.min(100, Math.max(0, elapsed));
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
