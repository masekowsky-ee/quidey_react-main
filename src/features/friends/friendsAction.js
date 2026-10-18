import { SET_FRIENDS, SET_FRIEND_REQUESTS, FRIEND_REQUEST_SENT, FRIEND_ADDED, FRIEND_REQUEST_REMOVED, FRIEND_REMOVED } from './friendsActionTypes';
import { apiFetch } from '../helperFunction';

export const fetchFriends = () => {
    return async (dispatch) => {
        const friends = await apiFetch('/api/friends');
        dispatch({ type: SET_FRIENDS, payload: friends });
    };
};

export const fetchFriendRequests = () => {
    return async (dispatch) => {
        const requests = await apiFetch('/api/friends/requests');
        dispatch({ type: SET_FRIEND_REQUESTS, payload: requests });
    };
};

// Resolves to 'pending' (request sent) or 'accepted' (they had already asked you).
// Rejects with the API error; error.code tells the UI which message to show.
export const sendFriendRequest = (username) => {
    return async (dispatch) => {
        const data = await apiFetch('/api/friends/requests', {
            method: 'POST',
            body: JSON.stringify({ username }),
        });
        if (data.status === 'accepted') {
            dispatch({ type: FRIEND_ADDED, payload: { friend: data.friend, userId: data.friend.id } });
        } else {
            dispatch({ type: FRIEND_REQUEST_SENT, payload: data.request });
        }
        return data.status;
    };
};

export const acceptFriendRequest = (requestId) => {
    return async (dispatch) => {
        const data = await apiFetch(`/api/friends/requests/${requestId}/accept`, { method: 'POST' });
        dispatch({ type: FRIEND_ADDED, payload: { friend: data.friend, requestId } });
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
