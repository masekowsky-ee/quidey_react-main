import { LOGIN_SUCCESS, LOGOUT, SET_USER, SET_ACCESS } from "./authActionTypes";

const initialState = {
    token: localStorage.getItem('token') || null,
    user: {
        username: null,
        display_name: null,
        email: null,
        birth_date: null,
    },
    // closed beta: may I use the app? checked = the server answered (until then nothing is shown)
    // betaRequest: my request for access, { status: 'pending' | 'approved' | 'declined', reason, createdAt } or null
    // isAdmin: sees the admin panel; adminPendingCount: open beta requests (admins only)
    access: { checked: false, isPro: false, isAdmin: false, adminPendingCount: 0, betaRequest: null },
};

const authReducer = (state = initialState, action) => {
    switch (action.type) {
        case LOGIN_SUCCESS:
            return {
                ...state,
                token: action.payload.token,
                user: {
                    ...state.user,
                    username: action.payload.username,
                },
            };
        case LOGOUT:
            return {
                ...state,
                token: null,
                user: null,
                access: initialState.access,
            };
        case SET_ACCESS:
            return {
                ...state,
                access: {
                    checked: true,
                    isPro: Boolean(action.payload.isPro),
                    isAdmin: Boolean(action.payload.isAdmin),
                    adminPendingCount: action.payload.adminPendingCount ?? 0,
                    betaRequest: action.payload.betaRequest ?? null,
                },
            };
        case SET_USER:
            return {
                ...state,
                user: {
                    ...state.user,
                    username: action.payload[0].username,
                    display_name: action.payload[0].display_name,
                    email: action.payload[0].email,
                    birth_date: action.payload[0].birth_date,
                    created_at: action.payload[0].created_at,
                },
            };
        default:
            return state;
    }
};

export default authReducer;