// "Sign in with Google": gets Google's ID token, which the server checks (POST /api/auth/google,
// see authAction.signInWithGoogle). Every token carries a nonce the server handed out just before
// (GET /api/auth/google/nonce), so a token can only be used once.
//
// Web: the browser goes to Google's sign-in page and comes back to /auth/google with the token in
// the address's hash (OpenID Connect, response_type=id_token). No script of Google's is loaded,
// so the Content-Security-Policy stays as it is. `state` (kept in sessionStorage) makes sure the
// answer belongs to a sign-in started here.
// Android app: the system's account picker (Credential Manager) through the app's own plugin
// "QuideyGoogle" (android/…/GoogleSignInPlugin.java); no page change.
//
// VITE_GOOGLE_CLIENT_ID: the OAuth client id of type "Web application" (the same the server lists
// in GOOGLE_CLIENT_IDS). Without it the button isn't shown.
import { registerPlugin } from '@capacitor/core';
import { apiFetch } from '../helperFunction';
import { isNativeApp } from '../native/native';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const GOOGLE_RETURN_PATH = '/auth/google';
const STATE_KEY = 'googleState';

const QuideyGoogle = registerPlugin('QuideyGoogle');

export const googleSignInAvailable = () => Boolean(CLIENT_ID);

const randomState = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

// Starts it. Web: leaves the page (resolves never). App: resolves Google's ID token, or null
// when the picker was closed.
export async function startGoogleSignIn() {
    const { nonce } = await apiFetch('/api/auth/google/nonce');
    if (isNativeApp()) {
        try {
            const { idToken } = await QuideyGoogle.signIn({ serverClientId: CLIENT_ID, nonce });
            return idToken || null;
        } catch (err) {
            // closed without picking an account: nothing to say
            if (err?.code === 'CANCELLED' || /cancel/i.test(err?.message ?? '')) return null;
            throw err;
        }
    }
    const state = randomState();
    try { sessionStorage.setItem(STATE_KEY, state); } catch { /* no storage: the answer can't be checked, see below */ }
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: `${window.location.origin}${GOOGLE_RETURN_PATH}`,
        response_type: 'id_token',
        scope: 'openid email profile',
        nonce,
        state,
        prompt: 'select_account',
    });
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    return new Promise(() => {});
}

// Back from Google's page (web, on /auth/google): { idToken } or { error }; the hash is removed
// from the address at once. null when there is nothing to read. Read once per page load (the
// same answer again after that, e.g. for React's second render in development).
let googleReturn;
export function readGoogleReturn() {
    if (googleReturn === undefined) googleReturn = takeGoogleReturn();
    return googleReturn;
}

// The token of that answer, handed out once: the server takes it only once (its nonce is used up
// then), so a second try (React running effects twice in development, the card mounted again)
// would only fail and show an error over the app that is already signed in.
let tokenClaimed = false;
export function claimGoogleToken() {
    const idToken = readGoogleReturn()?.idToken;
    if (!idToken || tokenClaimed) return null;
    tokenClaimed = true;
    return idToken;
}

function takeGoogleReturn() {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (!hash.has('id_token') && !hash.has('error')) return null;
    history.replaceState(history.state, '', window.location.pathname);
    let expected = null;
    try {
        expected = sessionStorage.getItem(STATE_KEY);
        sessionStorage.removeItem(STATE_KEY);
    } catch { /* no storage */ }
    if (hash.has('error')) return { error: hash.get('error') === 'access_denied' ? 'cancelled' : 'failed' };
    if (!expected || hash.get('state') !== expected) return { error: 'failed' };
    return { idToken: hash.get('id_token') };
}
