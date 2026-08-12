import { LOGIN_SUCCESS, LOGOUT } from "./authActionTypes";

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