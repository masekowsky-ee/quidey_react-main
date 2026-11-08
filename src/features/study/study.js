// Study goals (testers): subjects, goals with their parts, study settings, the plan.
// API under /api/tester/study. Thunks resolve with what the server answered and reject with
// apiFetch's error (status, code, data). The planner's sessions are ordinary tasks, so whatever
// changes them reloads the task list.

import { apiFetch } from '../helperFunction';
import { track } from '../usage/usage';
import { refreshTasks } from '../tasks/taskAction';

const SET_SUBJECTS = 'STUDY_SET_SUBJECTS';
const SUBJECT_SAVED = 'STUDY_SUBJECT_SAVED';
const SUBJECT_REMOVED = 'STUDY_SUBJECT_REMOVED';
const GOALS_SET = 'STUDY_GOALS_SET';
const GOAL_REMOVED = 'STUDY_GOAL_REMOVED';
const SETTINGS_SET = 'STUDY_SETTINGS_SET';
const STATUS_SET = 'STUDY_STATUS_SET';
const PREVIEW_SET = 'STUDY_PREVIEW_SET';

const initialState = { subjects: [], goals: {}, settings: null, status: null, preview: null };

export default function studyReducer(state = initialState, action) {
    switch (action.type) {
        case SET_SUBJECTS:
            return { ...state, subjects: action.payload };
        case SUBJECT_SAVED: {
            const saved = action.payload;
            const known = state.subjects.some(s => s.id === saved.id);
            return {
                ...state,
                subjects: known
                    ? state.subjects.map(s => {
                        // the answer to a change has no next goal (null): keep the one the list has
                        if (s.id !== saved.id) return s;
                        const fields = { ...saved };
                        delete fields.nextGoal;
                        return { ...s, ...fields };
                    })
                    : [...state.subjects, saved],
            };
        }
        case SUBJECT_REMOVED: {
            const goals = Object.fromEntries(Object.entries(state.goals).filter(([, g]) => g.subjectId !== action.payload));
            return { ...state, subjects: state.subjects.filter(s => s.id !== action.payload), goals };
        }
        case GOALS_SET:
            return { ...state, goals: { ...state.goals, ...Object.fromEntries(action.payload.map(g => [g.id, g])) } };
        case GOAL_REMOVED: {
            const goals = { ...state.goals };
            delete goals[action.payload];
            return { ...state, goals };
        }
        case SETTINGS_SET:
            return { ...state, settings: action.payload };
        case STATUS_SET:
            return { ...state, status: action.payload };
        case PREVIEW_SET:
            return { ...state, preview: action.payload };
        default:
            return state;
    }
}

// 90 -> '1,5', 180 -> '3' (one decimal, whole hours without; de comma, en dot)
export const hoursNumber = (minutes, language = 'de') => {
    const hours = Math.round((minutes / 60) * 10) / 10;
    const text = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
    return language === 'de' ? text.replace('.', ',') : text;
};

// '6,5 h' | '6.5 h'
export const formatHours = (minutes, language = 'de') => `${hoursNumber(minutes, language)} h`;

const BASE = '/api/tester/study';
const send = (method, body) => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const reloadTasks = (dispatch) => dispatch(refreshTasks()).catch(() => {});

// ---------- subjects ----------
export const fetchSubjects = () => async (dispatch) => {
    const list = await apiFetch(`${BASE}/subjects`);
    dispatch({ type: SET_SUBJECTS, payload: list });
    return list;
};

// id null: a new subject. { name, emoji?, color?, archived? }. Rejects with code subject_exists.
// A new colour recolours the subject's planned sessions on the server: the tasks are read again.
export const saveSubject = (id, data) => async (dispatch) => {
    const subject = await apiFetch(id == null ? `${BASE}/subjects` : `${BASE}/subjects/${id}`, send(id == null ? 'POST' : 'PATCH', data));
    dispatch({ type: SUBJECT_SAVED, payload: subject });
    if (id != null && data.color !== undefined) await reloadTasks(dispatch);
    return subject;
};

export const deleteSubject = (id) => async (dispatch) => {
    const result = await apiFetch(`${BASE}/subjects/${id}`, send('DELETE'));
    dispatch({ type: SUBJECT_REMOVED, payload: id });
    if (result.removedSessions) await reloadTasks(dispatch);
    return result;
};

// ---------- goals ----------
export const fetchGoal = (id) => async (dispatch) => {
    const goal = await apiFetch(`${BASE}/goals/${id}`);
    dispatch({ type: GOALS_SET, payload: [goal] });
    return goal;
};

// subjectId undefined: all of my goals
export const fetchGoals = (subjectId) => async (dispatch) => {
    const list = await apiFetch(subjectId == null ? `${BASE}/goals` : `${BASE}/goals?subject=${subjectId}`);
    dispatch({ type: GOALS_SET, payload: list });
    return list;
};

// { subjectId, kind, name, due, dueTime?, planMode, parts: [{ name, estimateMinutes, estimateSource? }] }
export const createGoal = (data) => async (dispatch) => {
    const goal = await apiFetch(`${BASE}/goals`, send('POST', data));
    dispatch({ type: GOALS_SET, payload: [goal] });
    return goal;
};

export const updateGoal = (id, change) => async (dispatch) => {
    const goal = await apiFetch(`${BASE}/goals/${id}`, send('PATCH', change));
    dispatch({ type: GOALS_SET, payload: [goal] });
    return goal;
};

// sessions: 'keep' | 'delete' (the goal's coming sessions)
export const deleteGoal = (id, sessions = 'keep') => async (dispatch) => {
    const result = await apiFetch(`${BASE}/goals/${id}?sessions=${sessions}`, send('DELETE'));
    dispatch({ type: GOAL_REMOVED, payload: id });
    if (result.removedSessions) await reloadTasks(dispatch);
    return result;
};

// ---------- parts ----------
// A part answers without its goal, and ticking one off changes the goal's sessions: the goal is read again.
const goalOfPart = (getState, partId) => Object.values(getState().study.goals).find(g => g.parts?.some(p => p.id === partId));
const reloadGoal = (dispatch, goalId) => (goalId == null ? null : dispatch(fetchGoal(goalId)).catch(() => {}));

// { name?, estimateMinutes?, doneAt? } (doneAt truthy: done now, null: reopen)
export const updatePart = (id, change) => async (dispatch, getState) => {
    const goal = goalOfPart(getState, id);
    const part = await apiFetch(`${BASE}/parts/${id}`, send('PATCH', change));
    await reloadGoal(dispatch, goal?.id);
    if (change.doneAt !== undefined) await reloadTasks(dispatch);
    return part;
};

// { name, estimateMinutes, estimateSource? }
export const addPart = (goalId, data) => async (dispatch) => {
    const part = await apiFetch(`${BASE}/goals/${goalId}/parts`, send('POST', data));
    await reloadGoal(dispatch, goalId);
    return part;
};

export const deletePart = (id) => async (dispatch, getState) => {
    const goal = goalOfPart(getState, id);
    const result = await apiFetch(`${BASE}/parts/${id}`, send('DELETE'));
    await reloadGoal(dispatch, goal?.id);
    if (result.removedSessions) await reloadTasks(dispatch);
    return result;
};

// ids: all part ids of the goal in the new order
export const reorderParts = (goalId, ids) => async (dispatch) => {
    const parts = await apiFetch(`${BASE}/goals/${goalId}/parts/order`, send('PUT', { ids }));
    await reloadGoal(dispatch, goalId);
    return parts;
};

// ---------- settings ----------
export const fetchStudySettings = () => async (dispatch) => {
    const settings = await apiFetch(`${BASE}/settings`);
    dispatch({ type: SETTINGS_SET, payload: settings });
    return settings;
};

// { windows?, sessionMinutes?, dailyMaxMinutes?, aiAuto? }
export const saveStudySettings = (data) => async (dispatch) => {
    const settings = await apiFetch(`${BASE}/settings`, send('PUT', data));
    dispatch({ type: SETTINGS_SET, payload: settings });
    return settings;
};

// ---------- status and plan ----------
export const fetchStudyStatus = () => async (dispatch) => {
    const status = await apiFetch(`${BASE}/status`);
    dispatch({ type: STATUS_SET, payload: status });
    return status;
};

export const fetchPlanPreview = () => async (dispatch) => {
    const preview = await apiFetch(`${BASE}/plan`);
    dispatch({ type: PREVIEW_SET, payload: preview });
    return preview;
};

// A 409 means the plan changed since the preview: the fresh one is stored, nothing was applied.
// Applying rewrites the goals' sessions: the goals in the store are read again (an open goal page shows them).
export const applyPlan = (inputHash) => async (dispatch, getState) => {
    try {
        await apiFetch(`${BASE}/replan`, send('POST', { inputHash }));
    } catch (err) {
        if (err.code === 'plan_changed' && err.data?.preview) dispatch({ type: PREVIEW_SET, payload: err.data.preview });
        throw err;
    }
    dispatch({ type: PREVIEW_SET, payload: null });
    track('study_plan_applied');
    await Promise.all([
        reloadTasks(dispatch),
        ...Object.keys(getState().study.goals).map(id => reloadGoal(dispatch, Number(id))),
    ]);
    return { ok: true };
};

export const dismissBehind = (goalId) => async (dispatch) => {
    const result = await apiFetch(`${BASE}/goals/${goalId}/dismiss`, send('POST'));
    await dispatch(fetchStudyStatus()).catch(() => {});
    return result;
};

// { subjectName, kind, due, parts: [name], subjectId?, ai? } -> { estimates: [{ minutes, source }], aiUsed, aiFailed }
export const estimateParts = (data) => () => apiFetch(`${BASE}/estimate`, send('POST', data));

// "Jetzt lernen": resolves with { task }
export const studyNow = (partId) => async (dispatch) => {
    const result = await apiFetch(`${BASE}/parts/${partId}/now`, send('POST'));
    await reloadTasks(dispatch);
    return result;
};

// The session's goal (from the store's goals, else the task row's study.goalId) is read again: its pin goes.
export const unpinSession = (taskId) => async (dispatch, getState) => {
    const state = getState();
    const goalId = Object.values(state.study.goals).find(g => g.sessions?.some(s => s.taskId === taskId))?.id
        ?? state.task?.tasks?.find(t => t.id === taskId)?.study?.goalId;
    const result = await apiFetch(`${BASE}/sessions/${taskId}/unpin`, send('POST'));
    await Promise.all([reloadTasks(dispatch), reloadGoal(dispatch, goalId)]);
    return result;
};

export const selectSubjects = (state) => state.study.subjects;
export const selectGoal = (id) => (state) => state.study.goals[id];
export const selectStudyStatus = (state) => state.study.status;
export const selectPlanPreview = (state) => state.study.preview;
export const selectStudySettings = (state) => state.study.settings;
