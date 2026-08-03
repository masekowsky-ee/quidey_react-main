import { SET_SESSION_PARAMS, SAVE_SESSION_DATA } from "./sessionActionTypes";

const initialState = {
    sessionParams: {
        group: 'all',
        time: 30 * 60 * 1000,
        breaks: false,
    },
    sessionData: [], // {time: x, workedTasks: [x1, x2, x3], group: 'xx', date: new Date()}
}

const sessionReducer = (state = initialState, action) => {
    switch(action.type){
        case SET_SESSION_PARAMS:
            return {
                ...state,
                sessionParams: action.payload,
            }
        case SAVE_SESSION_DATA:
            return {
                ...state,
                sessionData: [state.sessionData, action.payload],
            }

        default: 
            return state;
    }
}

export default sessionReducer;