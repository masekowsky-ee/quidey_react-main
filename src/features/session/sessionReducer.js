import { SET_SESSION_PARAMS, SAVE_SESSION_DATA, UPDATE_CURRENT_SESSION_DATA, SET_TIMER, ADD_WORKED_TASK, ADD_TASK_TIME, SET_WORKED_SESSIONS, SET_TIMER_MODE } from "./sessionActionTypes";
import { readStoredSessionMinutes, readStoredTimerMode } from "../settings/preferences";

// The default session length from the settings (30 minutes unless changed)
const DEFAULT_SESSION_MS = readStoredSessionMinutes() * 60 * 1000;
const START_MODE = readStoredTimerMode();

const initialState = {
    workedSessionData: [],
    currentSessionData: {
        totalTime: 0, 
        workedTasks: [], // task
        group: 'all', 
        date: new Date().toISOString(),
    },
    // 'timer' counts the session length down, 'stopwatch' counts up from zero
    timerMode: START_MODE,
    timer: {time: START_MODE === 'stopwatch' ? 0 : DEFAULT_SESSION_MS, active: false}, // milliseconds
    sessionParams: {
        time: DEFAULT_SESSION_MS, // milliseconds
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
        case SET_TIMER_MODE:
            // a fresh start in the new mode
            return {
                ...state,
                timerMode: action.payload,
                timer: {time: action.payload === 'stopwatch' ? 0 : state.sessionParams.time, active: false},
            }
        case SET_SESSION_PARAMS:
            return {
                ...state,
                sessionParams: action.payload,
                // a stopwatch doesn't use the session length
                timer: state.timerMode === 'stopwatch' ? state.timer : {time: action.payload.time, active: false},
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
        case ADD_TASK_TIME: {
            // time is in seconds, like totalTime; a task that isn't listed yet is added
            const { id, name, seconds } = action.payload;
            const tasks = state.currentSessionData.workedTasks;
            const workedTasks = tasks.some(t => t.id === id)
                ? tasks.map(t => t.id === id ? { ...t, time: t.time + seconds } : t)
                : [...tasks, { id, name, time: seconds }];
            return {
                ...state,
                currentSessionData: { ...state.currentSessionData, workedTasks },
            };
        }


        default: 
            return state;
    }
}

export default sessionReducer;