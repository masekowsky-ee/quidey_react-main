import {
    SET_SHARED_SESSIONS, SET_SHARED_SESSION, SHARED_SESSION_GONE,
    WORK_SWITCHED, WORK_SETTLED, WORK_RESTORED, WORK_STOPPED,
    SET_MY_SHARED_TASKS, SET_SHARED_HISTORY,
} from './togetherActionTypes';
import { LOGOUT } from '../auth/authActionTypes';

// My team stopwatch. It runs app-wide, so it keeps going while I look at other pages.
// sessionId/taskId: what I'm working on (null = not working); since: when the unsent time started;
// baseMs: my time on that task when I started it, workedMs: what was booked on it since then
// (both only for showing my total on it anywhere, also without the session loaded);
// inFlight: ms per task id that are on their way to the server (not in the session data yet).
export const idleWork = {
    sessionId: null,
    sessionName: null,
    taskId: null,
    taskName: null,
    since: 0,
    baseMs: 0,
    workedMs: 0,
    inFlight: {},
};

// The tasks of a session as GET /api/shared-sessions/my-tasks lists them
const toMineTask = (task, me) => ({
    id: task.id,
    name: task.name,
    description: task.description,
    done: task.done,
    assignee: task.assignee ?? null,
    myMs: task.time.find(t => t.userId === me)?.ms ?? 0,
    totalMs: task.totalMs,
});

// A session page answered: keep its group in the solo view up to date (or drop it once it ended)
function updateMine(mine, session) {
    if (!mine.some(s => s.id === session.id)) return mine;
    if (session.endedAt) return mine.filter(s => s.id !== session.id);
    return mine.map(s => s.id === session.id
        ? { ...s, name: session.name, tasks: session.tasks.map(task => toMineTask(task, session.me)) }
        : s);
}

// sessions/invites: the list page (GET /api/shared-sessions)
// current: the open session page, as GET /api/shared-sessions/:id returns it
// currentSeq: number of the request `current` came from. The page polls and also gets the
// session back from every change, so an older poll answering late must not overwrite newer data.
const initialState = {
    sessions: [],
    invites: [],
    current: null,
    currentSeq: 0,
    work: idleWork,
    // mine: running sessions I joined with their tasks, shown as groups on the solo home page
    mine: [],
    // history: my work in shared sessions, for the history page (null until loaded)
    history: null,
};

const addInFlight = (inFlight, taskId, ms) => ({ ...inFlight, [taskId]: (inFlight[taskId] ?? 0) + ms });

const togetherReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_SHARED_SESSIONS:
            return { ...state, sessions: action.payload.sessions, invites: action.payload.invites };
        case SET_SHARED_SESSION: {
            const { session, seq } = action.payload;
            if (seq < state.currentSeq) return state;
            return {
                ...state,
                current: session,
                currentSeq: seq,
                // the invite (if any) was just accepted
                invites: state.invites.filter(invite => invite.id !== session.id),
                // keep the names in the header pill current (renamed session)
                work: state.work.sessionId === session.id ? { ...state.work, sessionName: session.name } : state.work,
                mine: updateMine(state.mine, session),
            };
        }
        case SHARED_SESSION_GONE:
            // left, declined, deleted, or removed by the owner
            return {
                ...state,
                current: state.current?.id === action.payload ? null : state.current,
                sessions: state.sessions.filter(s => s.id !== action.payload),
                invites: state.invites.filter(invite => invite.id !== action.payload),
                work: state.work.sessionId === action.payload ? { ...idleWork, inFlight: state.work.inFlight } : state.work,
                mine: state.mine.filter(s => s.id !== action.payload),
            };
        case SET_MY_SHARED_TASKS:
            return { ...state, mine: action.payload };
        case SET_SHARED_HISTORY:
            return { ...state, history: action.payload };

        // From now on I work on `next` ({ sessionId, sessionName, taskId, taskName, baseMs }, or null to stop).
        // `booked` ({ taskId, ms }) is the time since the last report, which is now on its way.
        case WORK_SWITCHED: {
            const { next, booked, now } = action.payload;
            const work = state.work;
            const inFlight = booked ? addInFlight(work.inFlight, booked.taskId, booked.ms) : work.inFlight;
            if (!next) return { ...state, work: { ...idleWork, inFlight } };
            const sameTask = next.sessionId === work.sessionId && next.taskId === work.taskId;
            return {
                ...state,
                work: {
                    sessionId: next.sessionId,
                    sessionName: next.sessionName ?? work.sessionName,
                    taskId: next.taskId,
                    taskName: next.taskName ?? work.taskName,
                    since: now,
                    baseMs: sameTask ? work.baseMs : (next.baseMs ?? 0),
                    workedMs: sameTask ? work.workedMs + (booked?.ms ?? 0) : 0,
                    inFlight,
                },
            };
        }
        // the server's numbers include these ms now
        case WORK_SETTLED: {
            const { taskId, ms } = action.payload;
            const left = (state.work.inFlight[taskId] ?? 0) - ms;
            const inFlight = { ...state.work.inFlight };
            if (left > 0) inFlight[taskId] = left;
            else delete inFlight[taskId];
            return { ...state, work: { ...state.work, inFlight } };
        }
        // a report failed (offline): count that time again from the running stopwatch
        case WORK_RESTORED: {
            const { taskId, ms } = action.payload;
            if (state.work.taskId !== taskId) return state;
            return { ...state, work: { ...state.work, since: state.work.since - ms, workedMs: state.work.workedMs - ms } };
        }
        case WORK_STOPPED:
            if (action.payload && state.work.sessionId !== action.payload) return state;
            return { ...state, work: { ...idleWork, inFlight: state.work.inFlight } };

        case LOGOUT:
            return initialState;
        default:
            return state;
    }
};

export default togetherReducer;
