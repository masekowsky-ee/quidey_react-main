import { SET_SESSION_PARAMS, SAVE_SESSION_DATA, SET_TIMER } from "./sessionActionTypes";

export const setSessionParams = (paramsObj) => {
    return {
        type: SET_SESSION_PARAMS,
        payload: paramsObj,
    }
}

export const saveSessionData = (sessionDataObj) => {
    return {
        type: SAVE_SESSION_DATA,
        payload: sessionDataObj,
    }
}

export const setTimer = (time, active) => {
    return {
        type: SET_TIMER,
        payload: {time: time, active: active},
    }
}