import { SET_SESSION_PARAMS, SAVE_SESSION_DATA, UPDATE_CURRENT_SESSION_DATA, SET_TIMER, ADD_WORKED_TASK, SET_WORKED_SESSIONS } from "./sessionActionTypes";
import { apiFetch } from '../helperFunction';

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

export const selectCurrentSessionData = (state) => state.session.currentSessionData;

// How much of the session has elapsed, as a percentage from 0 to 100
export const selectTimerProgress = (state) => {
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
        const sessionDataObj = {
            ...selectCurrentSessionData(state),
            group: state.session.sessionParams.group ?? selectCurrentSessionData(state).group,
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
