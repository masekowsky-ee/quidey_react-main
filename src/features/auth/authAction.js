import { LOGIN_SUCCESS, LOGOUT, SET_USER, SET_ACCESS } from "./authActionTypes";
import { apiFetch, apiUrl } from '../helperFunction';

// Signs in with the username or the email address (the server tells them apart by the "@")
export const loginSuccess = (username, password) => {
    return async (dispatch) => {
        const data = await apiFetch("/api/login", {
            method: "POST",
            body: JSON.stringify({ username, password }),
        });

        localStorage.setItem("token", data.token);

        dispatch({
            type: LOGIN_SUCCESS,
            // the server sends the real username, also after signing in with the email address
            payload: { token: data.token, username: data.username ?? username },
        });
        // right after login/registration: pro users go to the app, everybody else to the beta screen
        await dispatch(fetchAccess()).catch(() => {});
    };
};

// Asks the server whether I may use the app (closed beta) and how my access request stands
export const fetchAccess = () => {
    return async (dispatch) => {
        const me = await apiFetch('/api/me');
        dispatch({ type: SET_ACCESS, payload: me });
        return me;
    };
};

// Asks for beta access, once, with a reason (10-1000 characters).
// Rejects with the API error (error.code: REASON_TOO_SHORT, REASON_TOO_LONG, ALREADY_REQUESTED, ALREADY_PRO).
export const requestBetaAccess = (reason) => {
    return async (dispatch, getState) => {
        const betaRequest = await apiFetch('/api/beta-requests', {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
        dispatch({ type: SET_ACCESS, payload: { ...getState().auth.access, betaRequest } });
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
        dispatch({ type: SET_ACCESS, payload: data });
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

// Saves display name and email; the store gets the row the API returns, which is also returned
// (email_verified is false again after a new address: the server sent a link to it).
// Rejects with the API error (error.code: INVALID_DISPLAY_NAME, INVALID_EMAIL, EMAIL_TAKEN).
export const updateProfile = (display_name, email) => {
    return async (dispatch) => {
        const user = await apiFetch('/api/users', {
            method: 'PUT',
            body: JSON.stringify({ display_name, email }),
        });
        dispatch({ type: SET_USER, payload: [user] });
        return user;
    };
}

// Confirms my email address with the token from the verification link (works signed out too).
// Rejects with the API error (error.code: INVALID_TOKEN, TOKEN_EXPIRED).
export function verifyEmail(token) {
    return apiFetch('/api/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
    });
}

// Sends me a new verification link; older links stop working.
// Rejects with the API error (error.code: ALREADY_VERIFIED, RATE_LIMITED).
export function resendVerificationMail() {
    return apiFetch('/api/verify-email/resend', { method: 'POST' });
}

// Same, signed out (sign-in is refused until the address is confirmed): a link to this address,
// if an unconfirmed account has it. The server answers the same either way.
// Rejects with the API error (error.code: INVALID_EMAIL, RATE_LIMITED).
export function requestVerificationMail(email) {
    return apiFetch('/api/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
}

// Rejects with the API error (error.code: WRONG_PASSWORD, WEAK_PASSWORD).
// All other logins of the account end; this device gets a new token and stays signed in.
export const changePassword = (currentPassword, newPassword) => {
    return async (dispatch, getState) => {
        const data = await apiFetch('/api/users/password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (data?.token) {
            localStorage.setItem('token', data.token);
            dispatch({ type: LOGIN_SUCCESS, payload: { token: data.token, username: getState().auth.user?.username } });
        }
    };
}

// Ends every login of this account, on all devices (this one too)
export const logoutEverywhere = () => {
    return async (dispatch) => {
        await apiFetch('/api/users/logout-all', { method: 'POST' });
        dispatch(logout());
    };
}

// Deletes the account for good (needs the password again), then signs out here.
// Rejects with the API error (error.code: WRONG_PASSWORD, LAST_ADMIN, RATE_LIMITED).
export const deleteAccount = (password) => {
    return async (dispatch) => {
        await apiFetch('/api/users', {
            method: 'DELETE',
            body: JSON.stringify({ password }),
        });
        dispatch(logout());
    };
}

// Creates the account; the server mails a confirmation link. Signing in only works after
// the address is confirmed, so there is no sign-in here.
// The terms, the privacy policy and the age were all confirmed in the form (the server refuses
// without them and stores when the terms and the privacy policy were accepted)
export const register = (username, display_name, email, birth_date, password) => {
    return async (dispatch, getState) => {
        // the confirmation mail comes in the app's language
        const language = getState().settings?.language;
        await apiFetch("/api/register", {
            method: "POST",
            body: JSON.stringify({ username, display_name, email, birth_date, password, language, accept_terms: true, accept_privacy: true, confirm_age: true }),
        });
    };
}