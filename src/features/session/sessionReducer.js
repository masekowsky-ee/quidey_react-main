import { SET_SESSION_PARAMS, SAVE_SESSION_DATA, UPDATE_CURRENT_SESSION_DATA, SET_TIMER, ADD_WORKED_TASK, ADD_TASK_TIME, SET_WORKED_SESSIONS, SET_TIMER_MODE, CLOCK_TICK, SET_FOCUS_TASK, SET_POMODORO, RESET_FOCUS } from "./sessionActionTypes";
import { readStoredSessionMinutes, readStoredTimerMode, readStoredPomodoro, TIMER_MODES } from "../settings/preferences";
import { readFocusRun } from "./focusRun";

// The default session length from the settings (30 minutes unless changed)
const DEFAULT_SESSION_MS = readStoredSessionMinutes() * 60 * 1000;
const START_MODE = readStoredTimerMode();

const freshSessionData = () => ({
    totalTime: 0, // seconds
    workedTasks: [], // { id, name, time (seconds) }
    group: 'all',
    date: new Date().toISOString(),
});

// Pomodoro: the phase that's on ('focus', 'short' or 'long' break), how many focus rounds are
// done, and the lengths (Settings / Fokusraum)
const freshPomodoro = (config = readStoredPomodoro()) => ({ phase: 'focus', round: 0, config });
export const phaseMs = (pomodoro) => pomodoro.config[pomodoro.phase] * 60 * 1000;

// What the timer starts from in a mode
const startTime = (mode, sessionMs, pomodoro) =>
    mode === 'stopwatch' ? 0 : mode === 'pomodoro' ? phaseMs(pomodoro) : sessionMs;

function freshState() {
    const pomodoro = freshPomodoro();
    return {
        workedSessionData: [],
        currentSessionData: freshSessionData(),
        // 'timer' counts the session length down, 'stopwatch' counts up from zero, 'pomodoro'
        // counts focus and break phases down in turns
        timerMode: START_MODE,
        timer: { time: startTime(START_MODE, DEFAULT_SESSION_MS, pomodoro), active: false }, // milliseconds
        // wall-clock time (ms) up to which the running timer is counted; null while it stands
        runningSince: null,
        sessionParams: {
            time: DEFAULT_SESSION_MS, // milliseconds
        },
        pomodoro,
        // the task chosen for focus ({ id, name, shared? }); whether one was chosen at all yet
        // (Home picks the first open task only before that)
        focusTask: null,
        focusPicked: false,
    };
}

// a session that was running on this device when the app was closed is taken up again
function initialState() {
    const state = freshState();
    const run = readFocusRun();
    if (!run || !TIMER_MODES.includes(run.timerMode)) return state;
    return {
        ...state,
        ...run,
        timer: { time: Math.max(0, Number(run.timer.time) || 0), active: Boolean(run.timer.active && run.runningSince) },
        runningSince: run.timer.active && typeof run.runningSince === 'number' ? run.runningSince : null,
        // the lengths are always today's settings
        pomodoro: { ...freshPomodoro(), ...(run.pomodoro ?? {}), config: state.pomodoro.config },
        currentSessionData: { ...freshSessionData(), ...(run.currentSessionData ?? {}) },
    };
}

// Books seconds on a task in the session ({ id, name } or null) and on the session's total
function book(sessionData, task, seconds) {
    if (!task) return { ...sessionData, totalTime: sessionData.totalTime + seconds };
    const tasks = sessionData.workedTasks;
    const workedTasks = tasks.some(t => t.id === task.id)
        ? tasks.map(t => t.id === task.id ? { ...t, time: t.time + seconds } : t)
        : [...tasks, { id: task.id, name: task.name, time: seconds }];
    return { ...sessionData, totalTime: sessionData.totalTime + seconds, workedTasks };
}

const sessionReducer = (state = initialState(), action) => {
    switch(action.type){
        case SAVE_SESSION_DATA:
            return {
                ...state,
                workedSessionData: [action.payload, ...state.workedSessionData], // newest first, like GET /api/sessions
                currentSessionData: freshSessionData(),
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
                runningSince: action.payload.active ? (action.now ?? Date.now()) : null,
            }
        case CLOCK_TICK: {
            // whole seconds that passed on the wall clock (also while the phone slept): the
            // countdown goes down by them, the stopwatch up, and in focus they are booked
            const { seconds, task } = action.payload;
            const stopwatch = state.timerMode === 'stopwatch';
            const ms = seconds * 1000;
            const time = stopwatch ? state.timer.time + ms : Math.max(0, state.timer.time - ms);
            const ended = !stopwatch && time === 0;
            const focusing = state.timerMode !== 'pomodoro' || state.pomodoro.phase === 'focus';
            return {
                ...state,
                timer: { time, active: !ended },
                runningSince: ended ? null : state.runningSince + ms,
                currentSessionData: focusing ? book(state.currentSessionData, task, seconds) : state.currentSessionData,
            };
        }
        case SET_TIMER_MODE: {
            // a fresh start in the new mode
            const pomodoro = action.payload === 'pomodoro' ? freshPomodoro(state.pomodoro.config) : state.pomodoro;
            return {
                ...state,
                timerMode: action.payload,
                pomodoro,
                timer: { time: startTime(action.payload, state.sessionParams.time, pomodoro), active: false },
                runningSince: null,
            }
        }
        case SET_POMODORO: {
            // the next phase, a reset, or other lengths; a timer that stands starts from the phase's length
            const pomodoro = { ...state.pomodoro, ...action.payload, config: { ...state.pomodoro.config, ...(action.payload.config ?? {}) } };
            const idle = state.timerMode === 'pomodoro' && !state.timer.active;
            return {
                ...state,
                pomodoro,
                ...(idle ? { timer: { time: phaseMs(pomodoro), active: false }, runningSince: null } : {}),
            };
        }
        case SET_SESSION_PARAMS:
            return {
                ...state,
                sessionParams: action.payload,
                // a stopwatch doesn't use the session length, Pomodoro its own lengths
                ...(state.timerMode === 'timer' ? { timer: { time: action.payload.time, active: false }, runningSince: null } : {}),
            }
        case SET_FOCUS_TASK:
            return {
                ...state,
                focusTask: action.payload,
                focusPicked: true,
            };
        case RESET_FOCUS:
            return { ...freshState(), workedSessionData: state.workedSessionData };
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
