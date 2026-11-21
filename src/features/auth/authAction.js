import { LOGIN_SUCCESS, LOGOUT, SET_USER, SET_ACCESS, TOUR_SEEN } from "./authActionTypes";
import { apiFetch, rawFetch, json, session } from '../api/api';
import { loadInto } from '../api/load';
import { SERVER_GONE_STATUSES, abortAfter } from '../api/transport';
import { forgetAccount, forgetToken, listAccounts, rememberAccount, switchAccount } from './accounts';
import { teardownAccount } from './teardown';
import { setUsageEnabled } from '../usage/usage';
import { refreshPush } from '../pwa/push';
import { resetFocus } from '../session/sessionAction';
import { saveAnswer, savedAnswer } from '../offline/offline';

// Signed in (password, Google): { token, username } from the server
const finishSignIn = (data) => {
    return async (dispatch) => {
        session.set(data.token);
        rememberAccount({ username: data.username, token: data.token, displayName: data.display_name });
        dispatch({ type: LOGIN_SUCCESS, payload: { token: data.token, username: data.username } });
        // right after signing in: who may use the app goes in, everybody else to the beta screen
        await dispatch(fetchAccess()).catch(() => {});
    };
};

// Signs in with the username or the email address (the server tells them apart by the "@")
export const loginSuccess = (username, password) => {
    return async (dispatch) => {
        const data = await apiFetch("/api/login", json('POST', { username, password }));
        // the server sends the real username, also after signing in with the email address
        await dispatch(finishSignIn({ ...data, username: data.username ?? username }));
    };
};

// Signs in with Google's ID token (features/auth/google.js gets it). Resolves null when signed
// in, or { token, email, name, username } when this Google account has no Quidey account yet
// (then registerWithGoogle with that token finishes it).
// Rejects with the API error (error.code: GOOGLE_INVALID, GOOGLE_OTHER_ACCOUNT, GOOGLE_DISABLED).
export const signInWithGoogle = (idToken) => {
    return async (dispatch) => {
        const data = await apiFetch('/api/auth/google', json('POST', { idToken }));
        if (data.signup) return data.signup;
        await dispatch(finishSignIn(data));
        return null;
    };
};

// A new account with Google: what every account needs (the address is Google's, no password).
// Rejects with the API error (error.code: INVALID_USERNAME, USERNAME_TAKEN, TOO_YOUNG, GOOGLE_SIGNUP_EXPIRED, …).
export const registerWithGoogle = ({ signupToken, username, displayName, birthDate }) => {
    return async (dispatch, getState) => {
        const data = await apiFetch('/api/auth/google/register', json('POST', {
                signupToken, username, display_name: displayName, birth_date: birthDate,
                language: getState().settings?.language, accept_terms: true, accept_privacy: true, confirm_age: true,
            }));
        await dispatch(finishSignIn(data));
    };
};

// Asks the server whether I may use the app (closed beta) and how my access request stands
export const fetchAccess = () => loadInto(SET_ACCESS, '/api/me');

// The intro tour was closed (finished or skipped): it won't open by itself again, on any device.
// Shown at once; if the server can't be reached, it opens again on the next start.
export const markTourSeen = () => {
    return (dispatch) => {
        dispatch({ type: TOUR_SEEN });
        apiFetch('/api/users/tour-seen', { method: 'PUT' }).catch(() => {});
    };
};

// Asks for beta access, once, with a reason (10-1000 characters).
// Rejects with the API error (error.code: REASON_TOO_SHORT, REASON_TOO_LONG, ALREADY_REQUESTED, ALREADY_PRO).
export const requestBetaAccess = (reason) => {
    return async (dispatch, getState) => {
        const betaRequest = await apiFetch('/api/beta-requests', json('POST', { reason }));
        dispatch({ type: SET_ACCESS, payload: { ...getState().auth.access, betaRequest } });
    };
};

// "Continue with the trial version" on the beta screen: all features with the free plan's limits.
// The access is asked again, so the app opens.
export const startTrial = () => {
    return async (dispatch) => {
        await apiFetch('/api/trial', json('POST', {}));
        await dispatch(fetchAccess());
    };
};

// Signs this account out on this device. Another account still signed in here takes over
// (the app loads again as that one); otherwise it's the sign-in.
export const logout = () => {
    return (dispatch, getState) => {
        const token = session.token();
        forgetToken(token);
        forgetAccount(getState().auth.user?.username);
        const next = listAccounts()[0];
        if (next) {
            // another account takes over: the app loads again as that one (switchAccount ends with
            // a second, harmless teardown), and the push notifications go over to it on its start
            teardownAccount({ leaving: true, token, keepPush: true, freezeFocus: true });
            switchAccount(next.username);
            return;
        }
        dispatch(resetFocus());
        teardownAccount({ leaving: true, token });
        session.clear();
        dispatch({ type: LOGOUT });
    };
};

// how long the check at start waits for the server when the device has a saved answer. The same
// kind of wait as offline.js START_PROBE_MS (the first request of the offline layer): the two do
// not have to agree, but neither should hold the app back much longer than the other.
const START_CHECK_MS = 5000;

export const checkAuth = () => {
    return async (dispatch) => {
        const token = session.token();

        if(!token) {
            return;
        }

        // signed in from what the device saved of the last answer (offline-first: the app opens
        // without a connection); the live answer replaces it as soon as there is one
        const fromSaved = async () => {
            const saved = await savedAnswer('/api/me');
            if (!saved?.username) return;
            dispatch({ type: LOGIN_SUCCESS, payload: { token, username: saved.username } });
            dispatch({ type: SET_ACCESS, payload: saved });
        };

        // with a saved answer to fall back on, a server that doesn't answer (a connection that
        // leads nowhere never says no) is given up on after a few seconds
        const hasSaved = Boolean(await savedAnswer('/api/me'));
        const { signal, done } = abortAfter(hasSaved ? START_CHECK_MS : 0);
        let response;
        try {
            // rawFetch, not apiFetch: the answer's status decides here (a real rejection signs out)
            response = await rawFetch('/api/me', { signal }, token);
        } catch {
            // backend not reachable (not started yet, offline): keep the token, try again on the next load
            await fromSaved();
            return;
        } finally {
            done();
        }
        // a gateway with nobody behind it (the API restarts): the same as no connection
        if (SERVER_GONE_STATUSES.includes(response.status)) {
            await fromSaved();
            return;
        }

        // only a real rejection signs out; a server error (e.g. 500 from the dev proxy) keeps the token
        if (response.status === 401 || response.status === 403) {
            forgetToken(token);
            session.clear();
            dispatch({ type: LOGOUT });
            return;
        }
        if (!response.ok) return;

        const data = await response.json();
        saveAnswer('/api/me', data);
        rememberAccount({ username: data.username, token });
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

        // the name shown in the account switcher
        if (data?.[0]) rememberAccount({ username: data[0].username, token: session.token(), displayName: data[0].display_name });
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
        const user = await apiFetch('/api/users', json('PUT', { display_name, email }));
        dispatch({ type: SET_USER, payload: [user] });
        return user;
    };
}

// Confirms my email address with the token from the verification link (works signed out too).
// Rejects with the API error (error.code: INVALID_TOKEN, TOKEN_EXPIRED).
export function verifyEmail(token) {
    return apiFetch('/api/verify-email', json('POST', { token }));
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
    return apiFetch('/api/resend-verification', json('POST', { email }));
}

// Rejects with the API error (error.code: WRONG_PASSWORD, WEAK_PASSWORD).
// All other logins of the account end; this device gets a new token and stays signed in.
// An account made with Google sets its first password without a current one (currentPassword '').
export const changePassword = (currentPassword, newPassword) => {
    return async (dispatch, getState) => {
        const data = await apiFetch('/api/users/password', json('PUT', { currentPassword, newPassword }));
        if (data?.token) {
            session.set(data.token);
            rememberAccount({ username: getState().auth.user?.username, token: data.token });
            dispatch({ type: LOGIN_SUCCESS, payload: { token: data.token, username: getState().auth.user?.username } });
        }
        // from now on it has one (an account made with Google sets its first here)
        dispatch({ type: SET_ACCESS, payload: { ...getState().auth.access, hasPassword: true } });
        // the server forgot the devices of the other logins, this one signs up again
        refreshPush();
    };
}

// Ends every login of this account, on all devices (this one too)
export const logoutEverywhere = () => {
    return async (dispatch) => {
        await apiFetch('/api/users/logout-all', { method: 'POST' });
        dispatch(logout());
    };
}

// Deletes the account for good, then signs out here. Confirmed with the password, or (an account
// made with Google, without one) with the username: { password } | { confirmUsername }.
// A running Pro subscription ends with it (the server cancels it).
// Rejects with the API error (error.code: WRONG_PASSWORD, WRONG_USERNAME, LAST_ADMIN, RATE_LIMITED).
export const deleteAccount = (confirmation) => {
    return async (dispatch) => {
        await apiFetch('/api/users', json('DELETE', confirmation));
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
        await apiFetch("/api/register", json('POST', { username, display_name, email, birth_date, password, language, accept_terms: true, accept_privacy: true, confirm_age: true }));
    };
}
export const selectUsageConsent = (state) => state.auth.access.usageConsent;

// Answer the question about the anonymous usage statistics (works before beta access too)
export const setUsageConsent = (granted) => {
    return async (dispatch, getState) => {
        const usageConsent = await apiFetch('/api/profile/usage-consent', json('PUT', { granted: Boolean(granted) }));
        dispatch({ type: SET_ACCESS, payload: { ...getState().auth.access, usageConsent } });
        setUsageEnabled(usageConsent.choice === 'granted', getState().auth.access.userId);
        return usageConsent;
    };
};
