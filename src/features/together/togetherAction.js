import { createSelector } from '@reduxjs/toolkit';
import { SET_SHARED_SESSIONS, SET_SHARED_SESSION, SHARED_SESSION_GONE, SET_MY_SHARED_TASKS, SET_SHARED_HISTORY } from './togetherActionTypes';
import { apiFetch, json, errorText } from '../api/api';
import { loadInto } from '../api/load';
import { noteAction } from '../onboarding/onboarding';

// the address of one shared session (the calendar's session source builds its task URLs on it too)
export const sessionUrl = (id) => `/api/shared-sessions/${id}`;

// Every request that returns a session gets a number when it starts; the reducer keeps
// only the newest one (see currentSeq), so slow polls can't undo a change.
let requestSeq = 0; // module-wide on purpose: the reducer compares these numbers across every session request

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

export const fetchSharedSessions = () => loadInto(SET_SHARED_SESSIONS, '/api/shared-sessions');

// A 404 means I'm not (or no longer) a member, or the session was deleted
export const fetchSharedSession = (id) => {
    return async (dispatch) => {
        try {
            return await dispatch(sessionRequest(sessionUrl(id)));
        } catch (err) {
            if (err.status === 404) dispatch({ type: SHARED_SESSION_GONE, payload: Number(id) });
            throw err;
        }
    };
};

export const createSharedSession = (name, friendIds = []) => async (dispatch) => {
    const session = await dispatch(sessionRequest('/api/shared-sessions', json('POST', { name, friendIds })));
    noteAction('session');
    return session;
};

export const joinSharedSession = (id) => sessionRequest(`${sessionUrl(id)}/join`, json('POST'));

export const inviteToSharedSession = (id, userIds) => sessionRequest(`${sessionUrl(id)}/invites`, json('POST', { userIds }));

// task: { taskId } to share one of my tasks, or { name, description } for a new one
export const addSharedTask = (id, task) => sessionRequest(`${sessionUrl(id)}/tasks`, json('POST', task));

// changes: { done?, assigneeId? (null = nobody) }
export const updateSharedTask = (id, taskId, changes) =>
    sessionRequest(`${sessionUrl(id)}/tasks/${taskId}`, json('PATCH', changes));

export const setSharedTaskDone = (id, taskId, done) => updateSharedTask(id, taskId, { done });

export const assignSharedTask = (id, taskId, assigneeId) => updateSharedTask(id, taskId, { assigneeId });

export const postSharedMessage = (id, text) => sessionRequest(`${sessionUrl(id)}/messages`, json('POST', { text }));

export const renameSharedSession = (id, name) =>
    sessionRequest(sessionUrl(id), json('PATCH', { name }));

export const removeSharedTask = (id, taskId) =>
    sessionRequest(`${sessionUrl(id)}/tasks/${taskId}`, { method: 'DELETE' });

// Sub-groups (experimental, testers): made and deleted by testers, entries go in with group_id
// on addSharedTask / updateSharedTask. Deleting one keeps its entries.
export const addSessionSubGroup = (id, name) => sessionRequest(`${sessionUrl(id)}/groups`, json('POST', { name }));
export const removeSessionSubGroup = (id, groupId) =>
    sessionRequest(`${sessionUrl(id)}/groups/${groupId}`, { method: 'DELETE' });

// currentTaskId: what I'm working on now (null = nothing); time: { taskId, ms } worked since the last report.
// keepalive lets the last report finish while the page is closing.
// onBooked runs right before the new totals are stored, so the caller can stop counting that time itself.
export const reportSharedActivity = (id, { currentTaskId, time }, { keepalive = false, onBooked } = {}) =>
    sessionRequest(`${sessionUrl(id)}/activity`, { ...json('POST', { currentTaskId, time }), keepalive }, onBooked);

export const endSharedSession = (id) => sessionRequest(`${sessionUrl(id)}/end`, json('POST'));

// My own id: leave the session or decline the invite. Someone else's (owner only): remove them.
export const removeSharedMember = (id, userId, myId) => {
    return async (dispatch) => {
        await apiFetch(`${sessionUrl(id)}/members/${userId}`, { method: 'DELETE' });
        if (userId === myId) {
            dispatch({ type: SHARED_SESSION_GONE, payload: id });
        } else {
            await dispatch(fetchSharedSession(id));
        }
    };
};

export const deleteSharedSession = (id) => {
    return async (dispatch) => {
        await apiFetch(sessionUrl(id), { method: 'DELETE' });
        dispatch({ type: SHARED_SESSION_GONE, payload: id });
    };
};

export const selectInviteCount = (state) => state.together.invites.length;

// ---------- shared sessions in the solo view and the history ----------

export const fetchMySharedTasks = () => loadInto(SET_MY_SHARED_TASKS, '/api/shared-sessions/my-tasks');

export const fetchSharedHistory = () => loadInto(SET_SHARED_HISTORY, '/api/shared-sessions/history');

// Ids of shared tasks in the solo view: "shared-<id>", so they never clash with own task ids
export const SHARED_TASK_PREFIX = 'shared-';
export const isSharedTaskId = (id) => typeof id === 'string' && id.startsWith(SHARED_TASK_PREFIX);
export const sharedTaskIdOf = (id) => Number(String(id).slice(SHARED_TASK_PREFIX.length));
const sharedGroupId = (sessionId) => `session-${sessionId}`;

// A shared task in the shape of an own task, plus where it belongs:
// shared: { sessionId, sessionName, taskId }, assignee, myMs (my time on it so far),
// addedBy / createdAt (who made it when), groupId (its sub-group in the session, or null)
const toSoloTask = (session, task) => ({
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
export const togetherErrorText = (t, err) => errorText(t, 'togetherError', err?.code);

export const timeOf = (task, userId) => task.time.find(t => t.userId === userId)?.ms ?? 0;
