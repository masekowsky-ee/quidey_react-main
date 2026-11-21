import { SET_FRIENDS, SET_FRIEND_REQUESTS, FRIEND_REQUEST_SENT, FRIEND_ADDED, FRIEND_REQUEST_REMOVED, FRIEND_REMOVED } from './friendsActionTypes';
import { apiFetch, json } from '../api/api';
import { loadInto } from '../api/load';
import { noteAction } from '../onboarding/onboarding';

export const fetchFriends = () => loadInto(SET_FRIENDS, '/api/friends');

export const fetchFriendRequests = () => loadInto(SET_FRIEND_REQUESTS, '/api/friends/requests');

// Resolves to 'pending' (request sent) or 'accepted' (they had already asked you).
// Rejects with the API error; error.code tells the UI which message to show.
export const sendFriendRequest = (username) => {
    return async (dispatch) => {
        const data = await apiFetch('/api/friends/requests', json('POST', { username }));
        if (data.status === 'accepted') {
            dispatch({ type: FRIEND_ADDED, payload: { friend: data.friend, userId: data.friend.id } });
        } else {
            dispatch({ type: FRIEND_REQUEST_SENT, payload: data.request });
        }
        noteAction(data.status === 'accepted' ? 'friend' : 'friendRequest');
        return data.status;
    };
};

export const acceptFriendRequest = (requestId) => {
    return async (dispatch) => {
        const data = await apiFetch(`/api/friends/requests/${requestId}/accept`, { method: 'POST' });
        dispatch({ type: FRIEND_ADDED, payload: { friend: data.friend, requestId } });
        noteAction('friend');
    };
};

// Declines an incoming request or cancels an outgoing one
export const removeFriendRequest = (requestId) => {
    return async (dispatch) => {
        await apiFetch(`/api/friends/requests/${requestId}`, { method: 'DELETE' });
        dispatch({ type: FRIEND_REQUEST_REMOVED, payload: requestId });
    };
};

export const removeFriend = (userId) => {
    return async (dispatch) => {
        await apiFetch(`/api/friends/${userId}`, { method: 'DELETE' });
        dispatch({ type: FRIEND_REMOVED, payload: userId });
    };
};

export const selectIncomingCount = (state) => state.friends.incoming.length;
