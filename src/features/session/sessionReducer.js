import { SET_SESSION_PARAMS, SAVE_SESSION_DATA, SET_TIMER } from "./sessionActionTypes";

const initialState = {
    sessionParams: {
        group: 'all',
        time: 30 * 60 * 1000,
        breaks: true,
    },
    workedSessionData: [], // {time: x, workedTasks: [x1, x2, x3], group: 'xx', date: new Date()}
    timer: {time: 30 * 60 * 1000, active: false},
}

const sessionReducer = (state = initialState, action) => {
    switch(action.type){
        case SET_SESSION_PARAMS:
            return {
                ...state,
                sessionParams: action.payload,
                timer: {time: action.payload.time, active: false},
            }
        case SAVE_SESSION_DATA:
            return {
                ...state,
                workedSessionData: [...state.workedSessionData, action.payload],
            }
        case SET_TIMER:
            return {
                ...state,
                timer: action.payload,
            }

        default: 
            return state;
    }
}

export default sessionReducer;