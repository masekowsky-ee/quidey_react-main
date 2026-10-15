import { SET_SESSION_PARAMS, SAVE_SESSION_DATA, UPDATE_CURRENT_SESSION_DATA, SET_TIMER, ADD_WORKED_TASK, SET_WORKED_SESSIONS } from "./sessionActionTypes";

const initialState = {
    workedSessionData: [],
    currentSessionData: {
        totalTime: 0, 
        workedTasks: [], // task
        group: 'all', 
        date: new Date().toISOString(),
    },
    timer: {time: 30 * 60 * 1000, active: false}, // 30 minutes in milliseconds
    sessionParams: {
        time: 30 * 60 * 1000, // 30 minutes in milliseconds
    }
}

const sessionReducer = (state = initialState, action) => {
    switch(action.type){
        case SAVE_SESSION_DATA:
            return {
                ...state,
                workedSessionData: [action.payload, ...state.workedSessionData], // newest first, like GET /api/sessions
                currentSessionData: {...initialState.currentSessionData, date: new Date().toISOString()},
            }
        case SET_WORKED_SESSIONS:
            return {
                ...state,
                workedSessionData: action.payload,
            }
        case UPDATE_CURRENT_SESSION_DATA:
            return {
                ...state,
                currentSessionData: { ...state.currentSessionData, ...action.payload },
            };
        case SET_TIMER:
            return {
                ...state,
                timer: action.payload,
            }
        case SET_SESSION_PARAMS:
            return {
                ...state,
                sessionParams: action.payload,
                timer: {time: action.payload.time, active: false},
            }
        case ADD_WORKED_TASK: {
            const tasks = state.currentSessionData.workedTasks;
            if (tasks.some(t => t.id === action.payload.id)) return state;
            return {
                ...state,
                currentSessionData: {
                    ...state.currentSessionData,
                    workedTasks: [...tasks, { id: action.payload.id, name: action.payload.name, time: 0 }],
                },
            };
        }


        default: 
            return state;
    }
}

export default sessionReducer;