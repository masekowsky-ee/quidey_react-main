import { createSelector } from '@reduxjs/toolkit';
import { SET_SHARED_SESSIONS, SET_SHARED_SESSION, SHARED_SESSION_GONE, SET_MY_SHARED_TASKS, SET_SHARED_HISTORY } from './togetherActionTypes';
import { apiFetch } from '../helperFunction';
import { noteAction } from '../onboarding/onboarding';

const base = (id) => `/api/shared-sessions/${id}`;

// Every request that returns a session gets a number when it starts; the reducer keeps
// only the newest one (see currentSeq), so slow polls can't undo a change.
let requestSeq = 0;

// Fills in lists an older backend doesn't send yet (e.g. events, assignee), so the pages
// never crash on a missing field; they just show less. receivedAt: when it came, so the
// others' running time can be counted on from there (othersRunningMs in work.js).
export function normalizeSession(session) {
    return {
        ...session,
        receivedAt: Date.now(),
        people: session.people ?? [],
        events: session.events ?? [],
        groups: session.groups ?? [],
        tasks: (session.tasks ?? []).map(task => ({ ...task, assignee: task.assignee ?? null, time: task.time ?? [] })),
    };
}

// Runs a request that answers with the whole session and stores it. Resolves to the session.
// beforeStore runs between the answer and the store update.
const sessionRequest = (url, options, beforeStore) => async (dispatch) => {
    const seq = ++requestSeq;
    const session = normalizeSession(await apiFetch(url, options));
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

export const createSharedSession = (name, friendIds = []) => async (dispatch) => {
    const session = await dispatch(sessionRequest('/api/shared-sessions', post({ name, friendIds })));
    noteAction('session');
    return session;
};

export const joinSharedSession = (id) => sessionRequest(`${base(id)}/join`, post());

export const inviteToSharedSession = (id, userIds) => sessionRequest(`${base(id)}/invites`, post({ userIds }));

// task: { taskId } to share one of my tasks, or { name, description } for a new one
export const addSharedTask = (id, task) => sessionRequest(`${base(id)}/tasks`, post(task));

// changes: { done?, assigneeId? (null = nobody) }
export const updateSharedTask = (id, taskId, changes) =>
    sessionRequest(`${base(id)}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(changes) });

export const setSharedTaskDone = (id, taskId, done) => updateSharedTask(id, taskId, { done });

export const assignSharedTask = (id, taskId, assigneeId) => updateSharedTask(id, taskId, { assigneeId });

export const postSharedMessage = (id, text) => sessionRequest(`${base(id)}/messages`, post({ text }));

export const renameSharedSession = (id, name) =>
    sessionRequest(base(id), { method: 'PATCH', body: JSON.stringify({ name }) });

export const removeSharedTask = (id, taskId) =>
    sessionRequest(`${base(id)}/tasks/${taskId}`, { method: 'DELETE' });

// Sub-groups (experimental, testers): made and deleted by testers, entries go in with group_id
// on addSharedTask / updateSharedTask. Deleting one keeps its entries.
export const addSessionSubGroup = (id, name) => sessionRequest(`/api/tester/shared-sessions/${id}/groups`, post({ name }));
export const removeSessionSubGroup = (id, groupId) =>
    sessionRequest(`/api/tester/shared-sessions/${id}/groups/${groupId}`, { method: 'DELETE' });

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

// ---------- shared sessions in the solo view and the history ----------

// Running sessions I joined, with their tasks (the groups on the solo home page)
export const fetchMySharedTasks = () => async (dispatch) => {
    const sessions = await apiFetch('/api/shared-sessions/my-tasks');
    dispatch({ type: SET_MY_SHARED_TASKS, payload: sessions });
};

// My work in shared sessions, for the history page
export const fetchSharedHistory = () => async (dispatch) => {
    const entries = await apiFetch('/api/shared-sessions/history');
    dispatch({ type: SET_SHARED_HISTORY, payload: entries });
};

// Ids of shared tasks in the solo view: "shared-<id>", so they never clash with own task ids
export const SHARED_TASK_PREFIX = 'shared-';
export const isSharedTaskId = (id) => typeof id === 'string' && id.startsWith(SHARED_TASK_PREFIX);
export const sharedTaskIdOf = (id) => Number(String(id).slice(SHARED_TASK_PREFIX.length));
export const sharedGroupId = (sessionId) => `session-${sessionId}`;

// A shared task in the shape of an own task, plus where it belongs:
// shared: { sessionId, sessionName, taskId }, assignee, myMs (my time on it so far),
// addedBy / createdAt (who made it when), groupId (its sub-group in the session, or null)
export const toSoloTask = (session, task) => ({
    id: `${SHARED_TASK_PREFIX}${task.id}`,
    name: task.name,
    description: task.description,
    done: task.done,
    due: null,
    prio: null,
    assignee: task.assignee,
    addedBy: task.addedBy ?? null,
    createdAt: task.createdAt ?? null,
    groupId: task.groupId ?? null,
    myMs: task.myMs,
    shared: { sessionId: session.id, sessionName: session.name, taskId: task.id },
});

// One group per running session I'm in: { id: 'session-5', name, sessionId, shared: true, tasks,
// subGroups: [{ id, name }] }. They can't be deleted; they go away when I leave or the session ends.
export const selectSharedGroups = createSelector(
    [(state) => state.together.mine],
    (mine) => mine.map(session => ({
        id: sharedGroupId(session.id),
        name: session.name,
        sessionId: session.id,
        shared: true,
        subGroups: session.groups ?? [],
        tasks: session.tasks.map(task => toSoloTask(session, task)),
    })),
);

export const selectSharedSoloTasks = createSelector(
    [selectSharedGroups],
    (groups) => groups.flatMap(group => group.tasks),
);

// Translated message for an API error, using the error code the backend sends
export function togetherErrorText(t, err) {
    const key = `togetherError_${err?.code}`;
    const text = t(key);
    return text === key ? t('friendError_generic') : text;
}

// Milliseconds one person spent on one task of a session
export const timeOf = (task, userId) => task.time.find(t => t.userId === userId)?.ms ?? 0;
