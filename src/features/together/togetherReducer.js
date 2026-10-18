import { SET_SHARED_SESSIONS, SET_SHARED_SESSION, SHARED_SESSION_GONE } from './togetherActionTypes';
import { LOGOUT } from '../auth/authActionTypes';

// sessions/invites: the list page (GET /api/shared-sessions)
// current: the open session page, as GET /api/shared-sessions/:id returns it
// currentSeq: number of the request `current` came from. The page polls and also gets the
// session back from every change, so an older poll answering late must not overwrite newer data.
const initialState = {
    sessions: [],
    invites: [],
    current: null,
    currentSeq: 0,
};

const togetherReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_SHARED_SESSIONS:
            return { ...state, sessions: action.payload.sessions, invites: action.payload.invites };
        case SET_SHARED_SESSION: {
            const { session, seq } = action.payload;
            if (seq < state.currentSeq) return state;
            return {
                ...state,
                current: session,
                currentSeq: seq,
                // the invite (if any) was just accepted
                invites: state.invites.filter(invite => invite.id !== session.id),
            };
        }
        case SHARED_SESSION_GONE:
            // left, declined, deleted, or removed by the owner
            return {
                ...state,
                current: state.current?.id === action.payload ? null : state.current,
                sessions: state.sessions.filter(s => s.id !== action.payload),
                invites: state.invites.filter(invite => invite.id !== action.payload),
            };
        case LOGOUT:
            return initialState;
        default:
            return state;
    }
};

export default togetherReducer;
