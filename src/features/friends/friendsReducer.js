import { SET_FRIENDS, SET_FRIEND_REQUESTS, FRIEND_REQUEST_SENT, FRIEND_ADDED, FRIEND_REQUEST_REMOVED, FRIEND_REMOVED } from './friendsActionTypes';
import { LOGOUT } from '../auth/authActionTypes';

// Users look like { id, username, displayName }; requests like { id, user, createdAt }
const initialState = {
    friends: [],
    incoming: [],
    outgoing: [],
};

const byName = (a, b) =>
    (a.displayName || a.username).localeCompare(b.displayName || b.username, undefined, { sensitivity: 'base' });

const friendsReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_FRIENDS:
            return { ...state, friends: action.payload };
        case SET_FRIEND_REQUESTS:
            return { ...state, incoming: action.payload.incoming, outgoing: action.payload.outgoing };
        case FRIEND_REQUEST_SENT:
            return { ...state, outgoing: [action.payload, ...state.outgoing] };
        case FRIEND_ADDED: {
            // accepted by request id (inbox) or became friends with a user directly (mutual request)
            const { friend, requestId, userId } = action.payload;
            const isDone = (request) => request.id === requestId || request.user.id === userId;
            return {
                ...state,
                friends: [...state.friends.filter(f => f.id !== friend.id), friend].sort(byName),
                incoming: state.incoming.filter(r => !isDone(r)),
                outgoing: state.outgoing.filter(r => !isDone(r)),
            };
        }
        case FRIEND_REQUEST_REMOVED:
            return {
                ...state,
                incoming: state.incoming.filter(r => r.id !== action.payload),
                outgoing: state.outgoing.filter(r => r.id !== action.payload),
            };
        case FRIEND_REMOVED:
            return { ...state, friends: state.friends.filter(f => f.id !== action.payload) };
        case LOGOUT:
            // never show the previous user's friends after switching accounts
            return initialState;
        default:
            return state;
    }
};

export default friendsReducer;
