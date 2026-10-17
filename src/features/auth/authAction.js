import { LOGIN_SUCCESS, LOGOUT, SET_USER } from "./authActionTypes";
import { apiFetch, apiUrl } from '../helperFunction';

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

export const checkAuth = () => {
    return async (dispatch) => {
        const token = localStorage.getItem("token");

        if(!token) {
            return;
        }

        let response;
        try {
            response = await fetch(apiUrl("/api/me"), {
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch {
            // backend not reachable (not started yet, offline): keep the token, try again on the next load
            return;
        }

        // only a real rejection signs out; a server error (e.g. 500 from the dev proxy) keeps the token
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            dispatch({ type: LOGOUT });
            return;
        }
        if (!response.ok) return;

        const data = await response.json();
        dispatch({
            type: LOGIN_SUCCESS,
            payload: { token, username: data.username },
        });
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