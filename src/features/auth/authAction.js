import { LOGIN_SUCCESS, LOGOUT, SET_USER, REGISTER } from "./authActionTypes";
import { apiFetch } from '../helperFunction';

export const loginSuccess = (username, password) => {
    return async (dispatch) => {
        const response = await fetch("http://localhost:3000/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Login failed");
        }

        const data = await response.json();

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

        try {
            const response = await fetch("http://localhost:3000/api/me", {
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
            localStorage.setItem("token", "hello");
            dispatch({ type: LOGOUT });
        }
    }
}

export const setUser = () => {
    return async (dispatch) => {

        const data = await apiFetch(`http://localhost:3000/api/users`, {method: "GET"});

        dispatch({
            type: SET_USER,
            payload: data,
        });

        console.log("User data fetched and dispatched:", data);
    }
}

export const register = (username, display_name, email, birth_date, password) => {
    return async (dispatch) => {
        const response = await fetch("http://localhost:3000/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, display_name, email, birth_date, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Sign up failed");
        }

        const data = await response.json();

        localStorage.setItem("token", data.token);

        dispatch({
            type: REGISTER,
            payload: { data, token: data.token },
        });
    };
}