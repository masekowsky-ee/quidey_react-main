import { shallowEqual, useSelector } from 'react-redux';
import { LOGOUT } from '../auth/authActionTypes';
import { SET_FRIENDS } from '../friends/friendsActionTypes';
import { SET_SHARED_SESSION } from '../together/togetherActionTypes';
import { useRealtime } from '../realtime/socket';

// Who has the app open right now: my friends, and the people in my open shared sessions and
// families (the server tells only them, and nobody who switched it off in their profile).
// The lists bring each person's `online` when they load; "presence:changed" { userId, online }
// keeps it current in between. The store is a plain map user id -> true / false.

const PRESENCE_SEEN = 'PRESENCE_SEEN';

export default function presenceReducer(state = {}, action) {
    switch (action.type) {
        case PRESENCE_SEEN: {
            const changed = Object.entries(action.payload).filter(([id, online]) => state[id] !== online);
            return changed.length === 0 ? state : { ...state, ...Object.fromEntries(changed) };
        }
        case SET_FRIENDS:
            return presenceReducer(state, rememberPresence(action.payload.map(friend => ({ user: friend, online: friend.online }))));
        case SET_SHARED_SESSION:
            return presenceReducer(state, rememberPresence(action.payload.session?.people));
        case LOGOUT:
            return {};
        default:
            return state;
    }
}

// people: [{ user: { id }, online }] (session or family members, friends as { user, online }).
// People without `online` (somebody who left) are left alone.
export const rememberPresence = (people) => ({
    type: PRESENCE_SEEN,
    payload: Object.fromEntries((people ?? [])
        .filter(person => person?.user?.id && typeof person.online === 'boolean')
        .map(person => [person.user.id, person.online])),
});

// Whether a person has the app open; `fallback` (e.g. what their list said) until the store knows
export const useOnline = (userId, fallback = false) =>
    useSelector(state => state.presence[userId] ?? fallback);

// My friends who have the app open, by name
const selectOnlineFriends = (state) => state.friends.friends.filter(friend => state.presence[friend.id] ?? friend.online);
export const useOnlineFriends = () => useSelector(selectOnlineFriends, shallowEqual);

// App-wide while signed in: a friend (or somebody in one of my sessions or families) came or went
export function usePresenceRealtime(dispatch) {
    useRealtime('presence:changed', (payload) => {
        if (!payload?.userId || typeof payload.online !== 'boolean') return;
        dispatch({ type: PRESENCE_SEEN, payload: { [payload.userId]: payload.online } });
    });
}
