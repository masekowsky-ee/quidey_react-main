// What the AI assistant proposes, carried out through the app's usual routes (the same thunks the
// forms use, so validation, sharing and realtime stay as they are).
//
// prepareActions(actions, tasks) sorts a reply's actions into cards for the chat. Moves and
// deletions are shown from the app's OWN copy of the entry (looked up by id in the task list),
// never from the model's `summary`; an id the app doesn't have (or a task shared with me, which
// only its owner may change) is left out and counted. Several actions on one id: a delete wins
// over changes, changes to one entry are merged.
//
// applyAction(action, deps) → { undo?, cancelled? }. deps: { dispatch, getState, navigate }.
//   create_entry: made at once; `undo` deletes it again.
//   update_entry / delete_entry: called only after the person confirmed (the card). A repeating
//     entry's delete asks what goes (DeleteScopeDialog); `cancelled` when that was cancelled.
//   study_plan: opens the new-goal sheet on Lernen with what was said, where the plan is
//     previewed before anything is saved (a draft, see features/study/goalDraft.js).

import { addTask, deleteTask, deleteTaskAsking, isSharedWithMe, updateTaskProps } from '../tasks/taskAction';
import { saveReminder, deleteReminder } from '../reminders/reminders';
import { fetchSubjects } from '../study/study';
import { writeGoalDraft } from '../study/goalDraft';
import { endOf, fromEnd } from '../tasks/eventTimes';
import { toInputDate } from '../helperFunction';

const clock = (time) => (typeof time === 'string' && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : null);

// the entry's fields as the app shows them: { name, day, time, end }
function fieldsOf(task) {
    const time = clock(task.due_time);
    return { name: task.name, day: toInputDate(task.due) || null, time, end: endOf(time, task.duration_minutes) || null, duration: task.duration_minutes ?? null };
}

// The proposed changes ({ name?, date?, time?, endTime? }) on my copy of the task → the fields
// to save. A time without a day takes today (as in the new-task form).
function changedFields(task, changes = {}) {
    const old = fieldsOf(task);
    const name = typeof changes.name === 'string' && changes.name.trim() ? changes.name.trim() : old.name;
    let day = changes.date ?? old.day;
    let time = changes.time ?? old.time;
    let duration = old.duration;
    if (changes.endTime) ({ time, duration } = fromEnd(changes.endTime, time, duration));
    if (time && !day) day = toInputDate(new Date());
    return { name, day, time, duration, end: endOf(time, duration) || null };
}

// [{ field: 'name' | 'day' | 'time' | 'end', from, to }]: only what really changes
export function changeRows(task, changes) {
    const old = fieldsOf(task);
    const next = changedFields(task, changes);
    return ['name', 'day', 'time', 'end']
        .filter(field => (old[field] ?? null) !== (next[field] ?? null))
        .map(field => ({ field, from: old[field] ?? null, to: next[field] ?? null }));
}

const snapshot = (task) => ({ id: task.id, name: task.name, kind: task.kind, due: task.due, due_time: task.due_time, duration_minutes: task.duration_minutes, repeat: task.repeat ?? null });

// → { cards: [{ type, action, task? }], missing: number of entries left out }
export function prepareActions(actions, tasks) {
    const list = Array.isArray(actions) ? actions : [];
    const deleted = new Set(list.filter(a => a?.type === 'delete_entry').map(a => a.id));
    const cards = [];
    const byId = new Map();
    const missing = new Set();
    for (const action of list) {
        if (action?.type === 'create_entry' && action.entry?.name) {
            cards.push({ type: 'create_entry', action });
        } else if (action?.type === 'study_plan' && action.subject) {
            cards.push({ type: 'study_plan', action });
        } else if (action?.type === 'update_entry' || action?.type === 'delete_entry') {
            if (action.type === 'update_entry' && deleted.has(action.id)) continue;
            const task = tasks.find(item => item.id === action.id && !item.projected);
            if (!task || isSharedWithMe(task)) { missing.add(action.id); continue; }
            const earlier = byId.get(action.id);
            if (earlier) {
                // a second change of the same entry joins the first; a second delete is the same delete
                if (action.type === 'update_entry') earlier.action = { ...earlier.action, changes: { ...earlier.action.changes, ...action.changes } };
                continue;
            }
            const card = { type: action.type, action: { type: action.type, id: action.id, changes: action.changes ?? {} }, task: snapshot(task) };
            byId.set(action.id, card);
            cards.push(card);
        }
    }
    // a "change" that changes nothing on my copy is no question
    const shown = cards.filter(card => card.type !== 'update_entry' || changeRows(card.task, card.action.changes).length > 0);
    return { cards: shown, missing: missing.size };
}

const notFound = () => Object.assign(new Error('Not found'), { code: 'NOT_FOUND' });
const findTask = (getState, id) => getState().task.tasks.find(task => task.id === id && !task.projected);

// a new entry as the AI read it ({ kind, name, due, time, durationMinutes, color, eventTypeId,
// reminders, prio }, the same as the quick entry's "Mit KI lesen") → made, with its undo
async function createEntry(entry, dispatch) {
    const due = entry.due || null;
    const time = due ? clock(entry.time) : null;
    if (entry.kind === 'reminder' && due && time) {
        const [y, m, d] = due.split('-').map(Number);
        const [h, min] = time.split(':').map(Number);
        const saved = await dispatch(saveReminder({ text: entry.name, at: new Date(y, m - 1, d, h, min) }));
        return { undo: () => dispatch(deleteReminder(saved.id)) };
    }
    // a reminder without a time of day: a task that reminds at its start
    const event = entry.kind === 'event' && Boolean(due);
    const reminders = entry.kind === 'reminder' ? [0] : (Array.isArray(entry.reminders) ? entry.reminders : []);
    const task = await dispatch(addTask(entry.name, due ?? '', '', event ? null : (entry.prio ?? null), null, undefined, {
        kind: event ? 'event' : 'task',
        event_type_id: event ? (entry.eventTypeId ?? null) : null,
        due_time: time,
        duration_minutes: entry.durationMinutes ?? null,
        color: entry.color ?? null,
        // reminders need a day
        reminders: due ? reminders : [],
    }));
    return { undo: () => dispatch(deleteTask(task.id)) };
}

async function openStudyPlan({ subject, examDate, topics }, { dispatch, getState, navigate }) {
    const subjects = await dispatch(fetchSubjects()).catch(() => getState().study?.subjects ?? []);
    const name = String(subject).trim();
    const same = (subjects ?? []).find(item => !item.archived && item.name.toLowerCase() === name.toLowerCase());
    writeGoalDraft({
        path: '/study', subjectId: null, step: 1,
        fields: {
            kind: 'exam', name, subject: same ? String(same.id) : 'new', newSubject: same ? '' : name,
            due: examDate ?? '', dueTime: '', planMode: null, shape: null,
        },
        text: (Array.isArray(topics) ? topics : []).join('\n'),
        known: {}, reviewOn: true, away: false,
    });
    navigate('/study?new=goal');
    return {};
}

export async function applyAction(action, deps) {
    const { dispatch, getState } = deps;
    switch (action?.type) {
        case 'create_entry':
            return createEntry(action.entry, dispatch);
        case 'update_entry': {
            const task = findTask(getState, action.id);
            if (!task) throw notFound();
            const next = changedFields(task, action.changes);
            await dispatch(updateTaskProps({ name: next.name, due: next.day ?? '', due_time: next.time, duration_minutes: next.duration }, task));
            return {};
        }
        case 'delete_entry': {
            const task = findTask(getState, action.id);
            if (!task) throw notFound();
            const done = await dispatch(deleteTaskAsking(task));
            return done ? {} : { cancelled: true };
        }
        case 'study_plan':
            return openStudyPlan(action, deps);
        default:
            return {};
    }
}
