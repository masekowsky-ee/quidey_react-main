import { LOGIN_SUCCESS, LOGOUT, SET_USER } from "./authActionTypes";
import { apiFetch } from '../helperFunction';

export const loginSuccess = (username, password) => {
    return async (dispatch) => {
        const data = await apiFetch("/api/login", {
            method: "POST",
            body: JSON.stringify({ username, password }),
        });

        localStorage.setItem("token", data.token);

        dispatch({
            type: LOGIN_SUCCESS,
            payload: { token: data.token, username },
        });
    };
};

export const logout = () => {
    return (dispatch) => {
        localStorage.removeItem('token');
        dispatch({ type: LOGOUT });
    };
};

export const checkAuth = () => {3
    return async (dispatch) => {
        const token = localStorage.getItem("token");

        if(!token) {
            return;
        }

        try {
            const response = await fetch("/api/me", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error("Token invalid");
            }

            const data = await response.json();

            dispatch({
                type: LOGIN_SUCCESS,
                payload: { token, username: data.username },
            });
        } catch (err) {
            console.log(err);
            localStorage.removeItem("token");
            dispatch({ type: LOGOUT });
        }
    }
}

export const setUser = () => {
    return async (dispatch) => {

        const data = await apiFetch(`/api/users`, {method: "GET"});

        dispatch({
            type: SET_USER,
            payload: data,
        });
    }
}

export const register = (username, display_name, email, birth_date, password) => {
    return async (dispatch) => {
        await apiFetch("/api/register", {
            method: "POST",
            body: JSON.stringify({ username, display_name, email, birth_date, password }),
        });

        // The register endpoint returns no token, so sign in right away
        await dispatch(loginSuccess(username, password));
    };
}