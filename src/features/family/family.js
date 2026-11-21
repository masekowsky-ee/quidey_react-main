import { useDispatch, useStore } from 'react-redux';
import { COMMUNITY_PATHS } from '../community/paths';
import { displayName, fill } from '../helperFunction';
import { apiFetch, json, errorText } from '../api/api';
import { loadInto } from '../api/load';
import { dateKey } from '../calendar/calendar';
import { LOGOUT } from '../auth/authActionTypes';
import { showToast } from '../toast/toast';
import { noteAction } from '../onboarding/onboarding';
import { useTranslation } from '../../i18n/useTranslation';
import { useRealtimeRefresh, useSafetyPoll } from '../realtime/socket';
import { FAMILY_CHANGED } from '../realtime/events';
import { quietly } from '../api/quietly';

// Quidey Family: a fixed group of accounts with a shared calendar, a
// list (entries without a day), a board, and a chat of their own, apart from the shared sessions. The store keeps only the list of my
// families and invites (menu badge, calendar picker); a family's page and calendar load the
// family itself. The server tells the members "family:changed" { familyId } and sends new chat
// messages as "family:message" { familyId, message }.

const base = '/api/families';

// The emojis a family can pick (the api checks the same list)
export const FAMILY_EMOJIS = ['🏡', '🌳', '⭐', '🌻', '🐾', '🎈', '🍀', '🔥', '🌙', '🎵', '☕', '📚', '🏖️', '❤️', '🦊', '🚀'];
const familyUrl = (id) => `${base}/${id}`;

const SET_FAMILIES = 'SET_FAMILIES';
const FAMILY_GONE = 'FAMILY_GONE';
// families: [{ id, name, owner, isOwner, memberCount }], invites: the same plus invitedBy
const initialState = { families: [], invites: [], loaded: false };

export default function familyReducer(state = initialState, action) {
    switch (action.type) {
        case SET_FAMILIES:
            return { families: action.payload?.families ?? [], invites: action.payload?.invites ?? [], loaded: true };
        case FAMILY_GONE:
            return {
                ...state,
                families: state.families.filter(f => f.id !== action.payload),
                invites: state.invites.filter(f => f.id !== action.payload),
            };
        case LOGOUT:
            return initialState;
        default:
            return state;
    }
}

export const selectFamilies = (state) => state.family.families;
export const selectFamilyInviteCount = (state) => state.family.invites.length;

export const fetchFamilies = () => loadInto(SET_FAMILIES, base);

// Each change answers with the whole family; the list (names, counts) is loaded again afterwards
const familyChange = (url, options) => async (dispatch) => {
    const family = await apiFetch(url, options);
    quietly(dispatch(fetchFamilies()));
    return family;
};

// { id, name, emoji, color, createdAt, owner, isOwner, me, note: { text, updatedAt, updatedBy } | null,
//   people: [{ user, status, isOwner, joinedAt, online }], tasks (with assignee),
//   week: { weekStart, people: [{ userId, xp, focusMin, streak }] } }
export const fetchFamily = (id) => apiFetch(familyUrl(id));
export const createFamily = (name, friendIds = []) => async (dispatch) => {
    const family = await dispatch(familyChange(base, json('POST', { name, friendIds })));
    noteAction('family');
    return family;
};
export const renameFamily = (id, name) => familyChange(familyUrl(id), json('PATCH', { name }));
// changes: { emoji?, color? } (owner), { note? } (any member; '' clears it)
export const updateFamily = (id, changes) => familyChange(familyUrl(id), json('PATCH', changes));
export const joinFamily = (id) => familyChange(`${familyUrl(id)}/join`, json('POST'));
export const inviteToFamily = (id, userIds) => familyChange(`${familyUrl(id)}/invites`, json('POST', { userIds }));

// My own id ('me'): leave or decline. Someone else's (owner only): remove them.
export const removeFamilyMember = (id, userId) => async (dispatch) => {
    await apiFetch(`${familyUrl(id)}/members/${userId}`, json('DELETE'));
    if (userId === 'me') dispatch({ type: FAMILY_GONE, payload: id });
    quietly(dispatch(fetchFamilies()));
};

export const deleteFamily = (id) => async (dispatch) => {
    await apiFetch(familyUrl(id), json('DELETE'));
    dispatch({ type: FAMILY_GONE, payload: id });
};

// ---------- the shared calendar (answers with the whole family) ----------

// task: { name, and optionally kind ('task' | 'event', an event needs a day), due, due_time, prio, description,
// duration_minutes, location, link, details, color, reminders (reach every member; only with a day),
// assignee_id (a joined member, or null), group_id (a sub-group) }. Without a day it is an item on the family's list.
export const addFamilyTask = (id, task) => apiFetch(`${familyUrl(id)}/tasks`, json('POST', task));
// One of my own open tasks / events moves in (it leaves my list): extra { group_id?, assignee_id? }.
// Resolves to the family; rejects with TASK_REPEATS, TASK_SHARED, TASK_DONE or TASK_NOT_FOUND.
export const moveToFamily = (id, taskId, extra = {}) => apiFetch(`${familyUrl(id)}/tasks`, json('POST', { taskId, ...extra }));

// What of mine can move into a family: my own open tasks and coming events, not repeating ones
// (a family's entries don't repeat) and not ones shared with somebody (they'd lose them)
export function movableTasks(tasks, today = new Date()) {
    const todayKey = dateKey(today);
    return tasks.filter(task => task.isOwner !== false && !task.done && !task.repeat && !(task.sharedWith?.length)
        && (task.kind !== 'event' || (task.due && dateKey(task.due) >= todayKey)));
}
export const updateFamilyTask = (id, taskId, changes) => apiFetch(`${familyUrl(id)}/tasks/${taskId}`, json('PATCH', changes));
export const removeFamilyTask = (id, taskId) => apiFetch(`${familyUrl(id)}/tasks/${taskId}`, json('DELETE'));

// Sub-groups (experimental, testers); deleting one keeps its entries
export const addFamilySubGroup = (id, name) => apiFetch(`${familyUrl(id)}/groups`, json('POST', { name }));
export const removeFamilySubGroup = (id, groupId) => apiFetch(`${familyUrl(id)}/groups/${groupId}`, json('DELETE'));

// ---------- the chat ----------

// { messages: [{ id, user, text, createdAt }] (oldest first), hasMore }
export const fetchFamilyMessages = (id, before) =>
    apiFetch(`${familyUrl(id)}/messages${before ? `?before=${before}` : ''}`);
export const sendFamilyMessage = (id, text) => apiFetch(`${familyUrl(id)}/messages`, json('POST', { text }));

export const familyErrorText = (t, err) => errorText(t, 'familyError', err?.code);

// App-wide: my families and invites, loaded at the start and whenever the server
// says one changed (a new invite comes with a toast); polled only as the safety net
export function useFamilyList(enabled) {
    const dispatch = useDispatch();
    const store = useStore();
    const { t } = useTranslation();
    const on = enabled;

    const load = async () => {
        const before = store.getState().family;
        try {
            const after = await dispatch(fetchFamilies());
            if (!before.loaded) return;
            const known = new Set(before.invites.map(invite => invite.id));
            for (const invite of after.invites.filter(item => !known.has(item.id))) {
                dispatch(showToast(fill(t('liveFamilyInvite'), { name: displayName(invite.invitedBy ?? invite.owner) }),
                    'info', { to: COMMUNITY_PATHS.family, detail: invite.name }));
            }
        } catch {
            // the next signal or poll tries again
        }
    };
    useSafetyPoll(load, { everyMs: 60 * 1000, enabled: on, immediately: true });
    useRealtimeRefresh([FAMILY_CHANGED], () => { if (on) load(); });
}
