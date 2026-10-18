import { SET_SHARED_SESSIONS, SET_SHARED_SESSION, SHARED_SESSION_GONE } from './togetherActionTypes';
import { apiFetch } from '../helperFunction';

const base = (id) => `/api/shared-sessions/${id}`;

// Every request that returns a session gets a number when it starts; the reducer keeps
// only the newest one (see currentSeq), so slow polls can't undo a change.
let requestSeq = 0;

// Runs a request that answers with the whole session and stores it. Resolves to the session.
// beforeStore runs between the answer and the store update.
const sessionRequest = (url, options, beforeStore) => async (dispatch) => {
    const seq = ++requestSeq;
    const session = await apiFetch(url, options);
    beforeStore?.();
    dispatch({ type: SET_SHARED_SESSION, payload: { session, seq } });
    return session;
};

const post = (body) => ({ method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const fetchSharedSessions = () => {
    return async (dispatch) => {
        const data = await apiFetch('/api/shared-sessions');
        dispatch({ type: SET_SHARED_SESSIONS, payload: data });
    };
};

// A 404 means I'm not (or no longer) a member, or the session was deleted
export const fetchSharedSession = (id) => {
    return async (dispatch) => {
        try {
            return await dispatch(sessionRequest(base(id)));
        } catch (err) {
            if (err.status === 404) dispatch({ type: SHARED_SESSION_GONE, payload: Number(id) });
            throw err;
        }
    };
};

export const createSharedSession = (name, friendIds = []) =>
    sessionRequest('/api/shared-sessions', post({ name, friendIds }));

export const joinSharedSession = (id) => sessionRequest(`${base(id)}/join`, post());

export const inviteToSharedSession = (id, userIds) => sessionRequest(`${base(id)}/invites`, post({ userIds }));

// task: { taskId } to share one of my tasks, or { name, description } for a new one
export const addSharedTask = (id, task) => sessionRequest(`${base(id)}/tasks`, post(task));

export const setSharedTaskDone = (id, taskId, done) =>
    sessionRequest(`${base(id)}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ done }) });

export const removeSharedTask = (id, taskId) =>
    sessionRequest(`${base(id)}/tasks/${taskId}`, { method: 'DELETE' });

// currentTaskId: what I'm working on now (null = nothing); time: { taskId, ms } worked since the last report.
// keepalive lets the last report finish while the page is closing.
// onBooked runs right before the new totals are stored, so the caller can stop counting that time itself.
export const reportSharedActivity = (id, { currentTaskId, time }, { keepalive = false, onBooked } = {}) =>
    sessionRequest(`${base(id)}/activity`, { ...post({ currentTaskId, time }), keepalive }, onBooked);

export const endSharedSession = (id) => sessionRequest(`${base(id)}/end`, post());

// My own id: leave the session or decline the invite. Someone else's (owner only): remove them.
export const removeSharedMember = (id, userId, myId) => {
    return async (dispatch) => {
        await apiFetch(`${base(id)}/members/${userId}`, { method: 'DELETE' });
        if (userId === myId) {
            dispatch({ type: SHARED_SESSION_GONE, payload: id });
        } else {
            await dispatch(fetchSharedSession(id));
        }
    };
};

export const deleteSharedSession = (id) => {
    return async (dispatch) => {
        await apiFetch(base(id), { method: 'DELETE' });
        dispatch({ type: SHARED_SESSION_GONE, payload: id });
    };
};

export const selectInviteCount = (state) => state.together.invites.length;

// Translated message for an API error, using the error code the backend sends
export function togetherErrorText(t, err) {
    const key = `togetherError_${err?.code}`;
    const text = t(key);
    return text === key ? t('friendError_generic') : text;
}

// Milliseconds one person spent on one task of a session
export const timeOf = (task, userId) => task.time.find(t => t.userId === userId)?.ms ?? 0;
