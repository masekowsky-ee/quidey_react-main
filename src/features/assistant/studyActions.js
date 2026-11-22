// The assistant's study-area actions (Lernen): prepared for the chat's cards, described from the
// app's OWN copy (state.study, never the model's words) and carried out through the study thunks,
// the same ones the forms use (limits, validation, realtime stay as they are).
//
//   loadStudyContext(actions, dispatch, getState?): reads the subjects and every goal an action names, so the
//     store has the app's copy before the cards are made. Throws (after trying all) when a read failed
//     for another reason than "not found".
//   describeStudy(action, study) → { kind, title, rows: [{ field, from, to }], sessions? } | null;
//     plain data (field names, raw values; the card translates). null: the thing isn't in `study`.
//   applyStudyAction(action, { dispatch, getState, navigate, sessions? }) → { undo? }:
//     create is made at once and returns `undo`; update / delete are called after the confirm.

import {
    saveSubject, deleteSubject, createGoal, updateGoal, deleteGoal, addPart, updatePart, deletePart,
    saveStudySettings, fetchSubjects, fetchGoal, fetchGoals, fetchPlanPreview, fetchStudySettings,
} from '../study/study';

export const STUDY_TYPES = ['study_create', 'study_update', 'study_delete', 'study_replan'];
export const isStudyAction = (action) => STUDY_TYPES.includes(action?.type);

const REPLAN_PATH = '/study?replan=1';

const goalIdOf = (action) => (action.target === 'goal' ? action.id : action.target === 'part' && action.type === 'study_create' ? action.goalId : null);

// Subjects: my copy in the store when it has any (writes keep it current), else read. A part, and a
// subject's delete (its sessions are counted), need goals with their parts and sessions: one
// GET /goals gives them all; goals named directly are read on their own when that didn't bring them.
export async function loadStudyContext(actions, dispatch, getState) {
    const list = (Array.isArray(actions) ? actions : []).filter(isStudyAction);
    if (list.length === 0) return;
    // a thing the server doesn't know (404) is simply not found (the card is left out and counted);
    // any other failure (network, server) is thrown once everything else was tried, so the caller can
    // say the real reason
    const failures = [];
    const soft = (fallback) => (err) => {
        if (err?.status !== 404 && err?.code !== 'NOT_FOUND') failures.push(err);
        return fallback;
    };
    if (!(getState?.().study?.subjects?.length > 0)) await dispatch(fetchSubjects()).catch(soft());
    // a settings card shows what the study times are now: read them when this session hasn't
    if (list.some(a => a.target === 'settings') && !getState?.().study?.settings) await dispatch(fetchStudySettings()).catch(soft());
    const needAll = list.some(a => (a.target === 'part' && a.type !== 'study_create') || (a.target === 'subject' && a.type === 'study_delete'));
    const known = new Set();
    if (needAll) (await dispatch(fetchGoals()).catch(soft([]))).forEach(g => known.add(g.id));
    const ids = [...new Set(list.map(goalIdOf).filter(id => id != null))].filter(id => !known.has(id));
    await Promise.all(ids.map(id => dispatch(fetchGoal(id)).catch(soft())));
    if (failures.length > 0) throw failures[0];
}

const subjects = (study) => study?.subjects ?? [];
const goalsOf = (study) => Object.values(study?.goals ?? {});
const findSubject = (study, id) => subjects(study).find(s => s.id === id);
const findGoal = (study, id) => study?.goals?.[id];
function findPart(study, id) {
    for (const goal of goalsOf(study)) {
        const part = goal.parts?.find(p => p.id === id);
        if (part) return { part, goal };
    }
    return null;
}
const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
// planned sessions still to come, as the backend's isPending (utils/studyStatus.js) counts them: not
// done, no focus time, today or later, and today's with a time only while that time is still ahead
// (done, focused and past ones stay when the goal goes)
const openSessions = (goal) => {
    const now = new Date();
    const today = now.toLocaleDateString('sv');
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return (goal?.sessions ?? []).filter((s) => {
        if (s.done || s.focusMs > 0) return false;
        if (s.due && s.due < today) return false;
        if (s.due && s.due > today) return true;
        if (!s.dueTime) return true;
        const [h, m] = String(s.dueTime).split(':').map(Number);
        return h * 60 + m > nowMinutes;
    }).length;
};
const FLAGS = ['archived', 'done'];

// the value of one field on my copy, as shown (a subject id becomes the subject's name)
function currentValue(target, copy, field, study) {
    if (target === 'settings') return copy?.[field] ?? null;
    if (target === 'part' && field === 'done') return Boolean(copy.doneAt);
    if (FLAGS.includes(field)) return Boolean(copy[field]);
    if (target === 'goal' && field === 'subjectId') return findSubject(study, copy.subjectId)?.name ?? null;
    return copy[field] ?? null;
}
const shownValue = (target, field, value, study) => {
    if (target === 'goal' && field === 'subjectId') return findSubject(study, value)?.name ?? null;
    return FLAGS.includes(field) ? Boolean(value) : value ?? null;
};
const rowField = (target, field) => (target === 'goal' && field === 'subjectId' ? 'subject' : field);
const equal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function describeStudy(action, study) {
    if (action?.type === 'study_replan') return { kind: 'replan', title: '', rows: [] };
    const { target } = action ?? {};
    if (action?.type === 'study_create') {
        if (target === 'part' && !findGoal(study, action.goalId)) return null;
        if (target === 'goal' && action.subjectId != null && !findSubject(study, action.subjectId)) return null;
        const fields = target === 'subject' ? ['name', 'emoji', 'color']
            : target === 'goal' ? ['name', 'kind', 'due', 'dueTime']
                : ['name', 'estimateMinutes'];
        const rows = fields.filter(f => action[f] != null).map(f => ({ field: f, from: null, to: action[f] }));
        if (target === 'goal') {
            const subject = action.subjectId != null ? findSubject(study, action.subjectId)?.name : action.subjectName;
            if (subject) rows.push({ field: 'subject', from: null, to: subject });
            rows.push({ field: 'parts', from: null, to: (action.parts ?? []).length });
        }
        if (target === 'part') rows.push({ field: 'goal', from: null, to: findGoal(study, action.goalId).name });
        return { kind: 'create', title: action.name ?? '', rows };
    }
    if (target === 'settings') {
        const rows = Object.entries(action.changes ?? {})
            .map(([field, to]) => ({ field, from: study?.settings?.[field] ?? null, to }))
            .filter(row => !equal(row.from, row.to));
        return { kind: 'update', title: '', rows };
    }
    const id = action?.id;
    let copy;
    let goal = null;
    if (target === 'subject') copy = findSubject(study, id);
    else if (target === 'goal') copy = goal = findGoal(study, id);
    else if (target === 'part') ({ part: copy, goal } = findPart(study, id) ?? {});
    if (!copy) return null;
    if (target === 'goal' && action.changes?.subjectId != null && !findSubject(study, action.changes.subjectId)) return null;
    if (action.type === 'study_delete') {
        const result = { kind: 'delete', title: copy.name, rows: [] };
        if (target === 'goal') result.sessions = openSessions(goal);
        if (target === 'subject') result.sessions = goalsOf(study).filter(g => g.subjectId === id).reduce((sum, g) => sum + openSessions(g), 0);
        return result;
    }
    const rows = Object.entries(action.changes ?? {})
        .map(([field, to]) => ({ field: rowField(target, field), from: currentValue(target, copy, field, study), to: shownValue(target, field, to, study) }))
        .filter(row => !equal(row.from, row.to));
    return { kind: 'update', title: copy.name, rows };
}

// the part's `done` flag is the API's doneAt (truthy: done now, null: reopened)
const partChange = ({ done, ...rest }) => (done === undefined ? rest : { ...rest, doneAt: done ? new Date().toISOString() : null });

// whether the subject has goals of any status (a subject's delete cascades to them and their sessions)
const hasGoals = async (dispatch, subjectId) => (await dispatch(fetchGoals(subjectId))).length > 0;

async function createGoalFor(action, { dispatch, getState }) {
    let subjectId = action.subjectId ?? null;
    let madeSubject = null;
    let known = null;
    if (subjectId == null) {
        const name = String(action.subjectName ?? '').trim();
        if (!name) throw Object.assign(new Error('Subject missing'), { code: 'invalid_input' });
        // archived ones too: the name is unique among all of a user's subjects (nothing is un-archived here)
        const match = (list) => (list ?? []).find(s => sameName(s.name, name));
        // my copy first: a subject an earlier action of this reply just made is in it
        const same = match(getState().study.subjects) ?? match(await dispatch(fetchSubjects()).catch(() => getState().study.subjects));
        if (same) { subjectId = same.id; known = same; }
        else {
            madeSubject = await dispatch(saveSubject(null, { name }));
            subjectId = madeSubject.id;
        }
    }
    known ??= (getState().study.subjects ?? []).find(s => s.id === subjectId) ?? null;
    // the planner skips goals of an archived subject: bring it back first (undo puts it away again)
    const reactivated = Boolean(known?.archived);
    if (reactivated) await dispatch(saveSubject(subjectId, { archived: false }));
    const parts = (action.parts ?? []).map(({ name, estimateMinutes }) => ({ name, estimateMinutes }));
    // as the new-goal sheet: no topics is a date only, else the study times when there are any
    let planMode = 'none';
    if (parts.length > 0) {
        const settings = getState().study.settings ?? await dispatch(fetchStudySettings()).catch(() => null);
        planMode = settings?.windows?.length > 0 ? 'slots' : 'days';
    }
    try {
        const goal = await dispatch(createGoal({
            subjectId, kind: action.kind, name: action.name, due: action.due,
            ...(action.dueTime ? { dueTime: action.dueTime } : {}), planMode, parts,
        }));
        return {
            undo: async () => {
                await dispatch(deleteGoal(goal.id, 'delete'));
                // goals added to the subject since stay: deleting it would cascade to them
                if (madeSubject && !(await hasGoals(dispatch, madeSubject.id))) await dispatch(deleteSubject(madeSubject.id));
                else if (reactivated && !(await hasGoals(dispatch, subjectId))) await dispatch(saveSubject(subjectId, { archived: true }));
            },
        };
    } catch (err) {
        if (madeSubject) await dispatch(deleteSubject(madeSubject.id)).catch(() => {});
        else if (reactivated) await dispatch(saveSubject(subjectId, { archived: true })).catch(() => {});
        throw err;
    }
}

async function create(action, deps) {
    const { dispatch } = deps;
    if (action.target === 'subject') {
        const { name, emoji, color } = action;
        const subject = await dispatch(saveSubject(null, { name, ...(emoji ? { emoji } : {}), ...(color ? { color } : {}) }));
        return {
            undo: async () => {
                if (await hasGoals(dispatch, subject.id)) throw Object.assign(new Error('The subject has goals'), { code: 'subject_has_goals' });
                await dispatch(deleteSubject(subject.id));
            },
        };
    }
    if (action.target === 'goal') return createGoalFor(action, deps);
    const part = await dispatch(addPart(action.goalId, { name: action.name, estimateMinutes: action.estimateMinutes }));
    return { undo: () => dispatch(deletePart(part.id)) };
}

export async function applyStudyAction(action, deps) {
    const { dispatch, navigate } = deps;
    const { target, id, changes } = action;
    switch (action.type) {
        case 'study_create':
            return create(action, deps);
        case 'study_update':
            if (target === 'subject') await dispatch(saveSubject(id, changes));
            else if (target === 'goal') await dispatch(updateGoal(id, changes));
            else if (target === 'part') await dispatch(updatePart(id, partChange(changes)));
            else if (target === 'settings') await dispatch(saveStudySettings(changes));
            return {};
        case 'study_delete':
            if (target === 'subject') await dispatch(deleteSubject(id));
            else if (target === 'goal') await dispatch(deleteGoal(id, deps.sessions === 'delete' ? 'delete' : 'keep'));
            else if (target === 'part') await dispatch(deletePart(id));
            return {};
        case 'study_replan':
            await dispatch(fetchPlanPreview());
            navigate(REPLAN_PATH);
            return {};
        default:
            return {};
    }
}
