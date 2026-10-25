import { useDispatch, useStore } from 'react-redux';
import { COMMUNITY_PATHS } from '../community/paths';
import { apiFetch, displayName, fill } from '../helperFunction';
import { LOGOUT } from '../auth/authActionTypes';
import { showToast } from '../toast/toast';
import { useTranslation } from '../../i18n/useTranslation';
import { useIsTester } from '../auth/tester';
import { useRealtimeRefresh, useSafetyPoll } from '../realtime/socket';

// Quidey Family (testers only for now): a fixed group of accounts with a shared calendar and a
// chat of their own, apart from the shared sessions. The store keeps only the list of my
// families and invites (menu badge, calendar picker); a family's page and calendar load the
// family itself. The server tells the members "family:changed" { familyId } and sends new chat
// messages as "family:message" { familyId, message }.

const base = '/api/tester/families';
const familyUrl = (id) => `${base}/${id}`;

const SET_FAMILIES = 'SET_FAMILIES';
const FAMILY_GONE = 'FAMILY_GONE';
// families: [{ id, name, owner, isOwner, memberCount }], invites: the same plus invitedBy
const initialState = { families: [], invites: [], loaded: false };

export default function familyReducer(state = initialState, action) {
    switch (action.type) {
        case SET_FAMILIES:
            return { families: action.payload.families, invites: action.payload.invites, loaded: true };
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
export const selectFamilyInviteCount = (state) => state.auth.access.isTester ? state.family.invites.length : 0;

const send = (method, body) => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const fetchFamilies = () => async (dispatch) => {
    const data = await apiFetch(base);
    dispatch({ type: SET_FAMILIES, payload: data });
    return data;
};

// Each change answers with the whole family; the list (names, counts) is loaded again afterwards
const familyChange = (url, options) => async (dispatch) => {
    const family = await apiFetch(url, options);
    dispatch(fetchFamilies()).catch(() => {});
    return family;
};

// { id, name, createdAt, owner, isOwner, me, people: [{ user, status, isOwner, joinedAt }], tasks }
export const fetchFamily = (id) => apiFetch(familyUrl(id));
export const createFamily = (name, friendIds = []) => familyChange(base, send('POST', { name, friendIds }));
export const renameFamily = (id, name) => familyChange(familyUrl(id), send('PATCH', { name }));
export const joinFamily = (id) => familyChange(`${familyUrl(id)}/join`, send('POST'));
export const inviteToFamily = (id, userIds) => familyChange(`${familyUrl(id)}/invites`, send('POST', { userIds }));

// My own id ('me'): leave or decline. Someone else's (owner only): remove them.
export const removeFamilyMember = (id, userId) => async (dispatch) => {
    await apiFetch(`${familyUrl(id)}/members/${userId}`, send('DELETE'));
    if (userId === 'me') dispatch({ type: FAMILY_GONE, payload: id });
    dispatch(fetchFamilies()).catch(() => {});
};

export const deleteFamily = (id) => async (dispatch) => {
    await apiFetch(familyUrl(id), send('DELETE'));
    dispatch({ type: FAMILY_GONE, payload: id });
};

// ---------- the shared calendar (answers with the whole family) ----------

// task: { name, and optionally due, due_time, prio, description, duration_minutes, location, link, details, color }
export const addFamilyTask = (id, task) => apiFetch(`${familyUrl(id)}/tasks`, send('POST', task));
export const updateFamilyTask = (id, taskId, changes) => apiFetch(`${familyUrl(id)}/tasks/${taskId}`, send('PATCH', changes));
export const removeFamilyTask = (id, taskId) => apiFetch(`${familyUrl(id)}/tasks/${taskId}`, send('DELETE'));

// ---------- the chat ----------

// { messages: [{ id, user, text, createdAt }] (oldest first), hasMore }
export const fetchFamilyMessages = (id, before) =>
    apiFetch(`${familyUrl(id)}/messages${before ? `?before=${before}` : ''}`);
export const sendFamilyMessage = (id, text) => apiFetch(`${familyUrl(id)}/messages`, send('POST', { text }));

// Translated message for an API error
export function familyErrorText(t, err) {
    const key = `familyError_${err?.code}`;
    const text = t(key);
    return text === key ? t('friendError_generic') : text;
}

// App-wide for testers: my families and invites, loaded at the start and whenever the server
// says one changed (a new invite comes with a toast); polled only as the safety net
export function useFamilyList(enabled) {
    const dispatch = useDispatch();
    const store = useStore();
    const { t } = useTranslation();
    const isTester = useIsTester();
    const on = enabled && isTester;

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
    useRealtimeRefresh(['family:changed'], () => { if (on) load(); });
}
