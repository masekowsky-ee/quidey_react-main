// Collections (testers first): things that belong together, whatever they are. Tasks, events
// and notes in one place ("Klausur Mathe": the exam, the tasks to learn for it, the formula
// sheet). Made from either side: on /collections, or from a task's / event's editor and a note
// ("In Sammlung"), which starts a new one named after it. One thing can be in several.
// API under /api/tester/collections; the server answers every change with the whole collection:
// { id, name, emoji, color, description, items: [{ kind: 'task' | 'note', id, addedAt }] }.

import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { apiFetch } from '../helperFunction';
import { selectIsTester } from '../auth/tester';

const SET_COLLECTIONS = 'SET_COLLECTIONS';
const COLLECTION_SAVED = 'COLLECTION_SAVED';
const COLLECTION_REMOVED = 'COLLECTION_REMOVED';

export const COLLECTION_NAME_MAX = 60;
export const COLLECTION_DESCRIPTION_MAX = 500;
export const COLLECTION_EMOJIS = ['🗂️', '📐', '🎓', '📝', '🧪', '📚', '🎯', '🗓️', '💼', '✈️', '🏠', '🎉', '💡', '🧠', '🏃', '🎨'];

export default function collectionsReducer(state = { list: [], loaded: false }, action) {
    switch (action.type) {
        case SET_COLLECTIONS:
            return { list: action.payload, loaded: true };
        case COLLECTION_SAVED: {
            const others = state.list.filter(collection => collection.id !== action.payload.id);
            // the one just changed comes first (as the server orders them: last changed first)
            return { ...state, list: [action.payload, ...others] };
        }
        case COLLECTION_REMOVED:
            return { ...state, list: state.list.filter(collection => collection.id !== action.payload) };
        default:
            return state;
    }
}

const saved = (dispatch) => (collection) => {
    dispatch({ type: COLLECTION_SAVED, payload: collection });
    return collection;
};

// one request at a time: every task row's labels ask for them when they first show
let loading = null;
export const fetchCollections = () => (dispatch) => {
    loading ??= apiFetch('/api/tester/collections')
        .then(list => {
            dispatch({ type: SET_COLLECTIONS, payload: list });
            return list;
        })
        .finally(() => { loading = null; });
    return loading;
};

// { name, emoji?, color?, description?, items?: [{ kind, id }] }
export const createCollection = (collection) => (dispatch) =>
    apiFetch('/api/tester/collections', { method: 'POST', body: JSON.stringify(collection) }).then(saved(dispatch));

export const updateCollection = (id, change) => (dispatch) =>
    apiFetch(`/api/tester/collections/${id}`, { method: 'PUT', body: JSON.stringify(change) }).then(saved(dispatch));

export const deleteCollection = (id) => async (dispatch) => {
    await apiFetch(`/api/tester/collections/${id}`, { method: 'DELETE' });
    dispatch({ type: COLLECTION_REMOVED, payload: id });
};

// item: { kind: 'task' | 'note', id }
export const addToCollection = (id, item) => (dispatch) =>
    apiFetch(`/api/tester/collections/${id}/items`, { method: 'POST', body: JSON.stringify({ kind: item.kind, id: item.id }) }).then(saved(dispatch));

export const removeFromCollection = (id, item) => (dispatch) =>
    apiFetch(`/api/tester/collections/${id}/items/${item.kind}/${item.id}`, { method: 'DELETE' }).then(saved(dispatch));

export const selectCollections = (state) => state.collections.list;
export const selectCollectionsLoaded = (state) => state.collections.loaded;

export const hasItem = (collection, item) => collection.items.some(entry => entry.kind === item.kind && entry.id === item.id);

// the collections a task / event / note is in
export const collectionsOf = (list, item) => list.filter(collection => hasItem(collection, item));

// what is in a collection, found in what the app has: tasks (state.task.tasks, events among
// them) and notes (as loaded); things not (or no longer) there are left out
export function collectionContents(collection, tasks, notes) {
    const byTask = new Map(tasks.map(task => [task.id, task]));
    const byNote = new Map((notes ?? []).map(note => [note.id, note]));
    const found = collection.items.map(item => (item.kind === 'task' ? byTask.get(item.id) : byNote.get(item.id)) && item);
    const entries = found.filter(Boolean);
    const all = entries.filter(item => item.kind === 'task').map(item => byTask.get(item.id));
    return {
        events: all.filter(task => task.kind === 'event')
            .sort((a, b) => String(a.due ?? '').localeCompare(String(b.due ?? '')) || String(a.due_time ?? '').localeCompare(String(b.due_time ?? ''))),
        tasks: all.filter(task => task.kind !== 'event')
            .sort((a, b) => Number(a.done) - Number(b.done) || String(a.due ?? '9999').localeCompare(String(b.due ?? '9999'))),
        notes: entries.filter(item => item.kind === 'note').map(item => byNote.get(item.id)),
    };
}

// loads my collections once (testers only; for everybody else the list stays empty)
export function useCollections() {
    const dispatch = useDispatch();
    const isTester = useSelector(selectIsTester);
    const loaded = useSelector(selectCollectionsLoaded);
    useEffect(() => {
        if (isTester && !loaded) dispatch(fetchCollections()).catch(() => {});
    }, [isTester, loaded, dispatch]);
    return useSelector(selectCollections);
}

// ---------- in place of groups (testers) ----------
// For testers collections take the place of groups: Home's chips and list, a task's labels, the
// calendar's filter, the new-task form and the statistics (their groups were taken over once by
// the server). A collection then goes around as a group:
// { id: 'collection-<id>', collection: true, collectionId, name, emoji, color }.
export const asGroup = (collection) => ({
    id: `collection-${collection.id}`, collection: true, collectionId: collection.id,
    name: collection.name, emoji: collection.emoji, color: collection.color, description: collection.description,
});

// the ids of the tasks (events among them) in a collection
export const taskIdsIn = (collection) => new Set(collection.items.filter(item => item.kind === 'task').map(item => item.id));

// what tasks are sorted into here: my groups, or for testers my collections (as groups).
// { collections, groups: [group], groupsOf(task): [group] }
export function useTaskGroups() {
    const isTester = useSelector(selectIsTester);
    const collections = useCollections();
    const groups = useSelector(state => state.task.groups);
    return useMemo(() => {
        if (!isTester) {
            // a group named "all" from older accounts is "all" itself
            const own = groups.filter(group => group.name !== 'all');
            return {
                collections: false,
                groups: own,
                groupsOf: (task) => (task.group_ids ?? []).map(id => own.find(group => group.id === id)).filter(Boolean),
            };
        }
        const list = collections.map(asGroup);
        const byTask = new Map();
        collections.forEach((collection, index) => {
            for (const id of taskIdsIn(collection)) byTask.set(id, [...(byTask.get(id) ?? []), list[index]]);
        });
        return { collections: true, groups: list, groupsOf: (task) => byTask.get(task.id) ?? [] };
    }, [isTester, collections, groups]);
}

// a new task goes into the group shown where it was made: a collection takes it after it is made
// (a group of mine is handled by addTask itself)
export const addToShownCollection = (group, task) => (dispatch) =>
    group?.collection && task?.id != null
        ? dispatch(addToCollection(group.collectionId, { kind: 'task', id: task.id }))
        : Promise.resolve(null);
