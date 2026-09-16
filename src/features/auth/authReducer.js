import { LOGIN_SUCCESS, LOGOUT, SET_USER, REGISTER } from "./authActionTypes";

const initialState = {
    token: localStorage.getItem('token') || null,
    user: {
        username: null,
        display_name: null,
        email: null,
        birth_date: null,
    }
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
                },
            };
        case REGISTER:
            return {
                ...state,
                token: action.payload.token,
                user: {
                    ...state.user,
                    username: action.payload.data.username,
                    display_name: action.payload.data.display_name,
                    email: action.payload.data.email,
                    birth_date: action.payload.data.birth_date,
                },
            };
        
        default:
            return state;
    }
};

export default authReducer;