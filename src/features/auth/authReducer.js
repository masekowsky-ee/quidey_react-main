import { LOGIN_SUCCESS, LOGOUT } from "./authActionTypes";

const initialState = {
    token: localStorage.getItem('token') || null,
    username: null,
};

const authReducer = (state = initialState, action) => {
    switch (action.type) {
        case LOGIN_SUCCESS:
            return {
                ...state,
                token: action.payload.token,
                username: action.payload.username,
            };
        case LOGOUT:
            return {
                ...state,
                token: null,
                username: null,
            };
        default:
            return state;
    }
};

export default authReducer;