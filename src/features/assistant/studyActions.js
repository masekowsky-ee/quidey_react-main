// The assistant's study-area actions (Lernen): prepared for the chat's cards, described from the
// app's OWN copy (state.study, never the model's words) and carried out through the study thunks,
// the same ones the forms use (limits, validation, realtime stay as they are).
//
//   loadStudyContext(actions, dispatch, getState?): reads the subjects and every goal an action names, so the
//     store has the app's copy before the cards are made.
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
    if (!(getState?.().study?.subjects?.length > 0)) await dispatch(fetchSubjects()).catch(() => {});
    const needAll = list.some(a => (a.target === 'part' && a.type !== 'study_create') || (a.target === 'subject' && a.type === 'study_delete'));
    const known = new Set();
    if (needAll) (await dispatch(fetchGoals()).catch(() => [])).forEach(g => known.add(g.id));
    const ids = [...new Set(list.map(goalIdOf).filter(id => id != null))].filter(id => !known.has(id));
    await Promise.all(ids.map(id => dispatch(fetchGoal(id)).catch(() => {})));
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
// planned sessions still to come (a done one or one of a past day stays when the goal goes)
const openSessions = (goal) => {
    const today = new Date().toLocaleDateString('sv');
    return (goal?.sessions ?? []).filter(s => !s.done && !(s.due && s.due < today)).length;
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

async function createGoalFor(action, { dispatch, getState }) {
    let subjectId = action.subjectId ?? null;
    let madeSubject = null;
    if (subjectId == null) {
        const name = String(action.subjectName ?? '').trim();
        if (!name) throw Object.assign(new Error('Subject missing'), { code: 'invalid_input' });
        const match = (list) => (list ?? []).find(s => !s.archived && sameName(s.name, name));
        // my copy first: a subject an earlier action of this reply just made is in it
        const same = match(getState().study.subjects) ?? match(await dispatch(fetchSubjects()).catch(() => getState().study.subjects));
        if (same) subjectId = same.id;
        else {
            madeSubject = await dispatch(saveSubject(null, { name }));
            subjectId = madeSubject.id;
        }
    }
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
                if (madeSubject) await dispatch(deleteSubject(madeSubject.id));
            },
        };
    } catch (err) {
        if (madeSubject) await dispatch(deleteSubject(madeSubject.id)).catch(() => {});
        throw err;
    }
}

async function create(action, deps) {
    const { dispatch } = deps;
    if (action.target === 'subject') {
        const { name, emoji, color } = action;
        const subject = await dispatch(saveSubject(null, { name, ...(emoji ? { emoji } : {}), ...(color ? { color } : {}) }));
        return { undo: () => dispatch(deleteSubject(subject.id)) };
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
