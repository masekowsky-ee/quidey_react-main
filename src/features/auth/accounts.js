// Several accounts signed in on one device, switched with one tap. Each keeps its own sign-in
// token in localStorage 'accounts' as [{ username, displayName, token }]; 'token' is the one in
// use (the rest of the app only knows that one). Nothing leaves the device.
// Switching loads the app again, so no list, socket or timer of the other account stays behind.
import { clearFocusRun } from '../session/focusRun';

const KEY = 'accounts';
export const MAX_ACCOUNTS = 5;

// settings that belong to one account, not to the device: they go when the account changes
const PER_ACCOUNT_KEYS = ['teamSessionId'];

const sameName = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

export function listAccounts() {
    try {
        const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
        return Array.isArray(list)
            ? list.filter(account => account && typeof account.username === 'string' && typeof account.token === 'string')
            : [];
    } catch {
        return [];
    }
}

function store(list) {
    try {
        if (list.length === 0) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ACCOUNTS)));
    } catch { /* storage full or blocked: only this device forgets */ }
}

// Adds an account or updates its token / name; it keeps its place in the list
export function rememberAccount({ username, token, displayName }) {
    if (!username || !token) return;
    const list = listAccounts();
    const index = list.findIndex(account => sameName(account.username, username));
    const known = index >= 0 ? list[index] : null;
    const next = { username, token, displayName: displayName ?? known?.displayName ?? null };
    if (index >= 0) list[index] = next;
    else list.push(next);
    store(list);
}

export function forgetAccount(username) {
    store(listAccounts().filter(account => !sameName(account.username, username)));
}

export const currentToken = () => {
    try {
        return localStorage.getItem('token');
    } catch {
        return null;
    }
};

// The accounts other than the one in use
export const otherAccounts = (username) => listAccounts().filter(account => !sameName(account.username, username));

function reloadAs(token) {
    // a focus session running here belongs to the account that started it
    clearFocusRun({ freeze: true });
    try {
        if (token) localStorage.setItem('token', token);
        else localStorage.removeItem('token');
        for (const key of PER_ACCOUNT_KEYS) localStorage.removeItem(key);
    } catch { /* blocked storage: the reload shows the sign-in */ }
    window.location.assign('/');
}

// Goes over to another remembered account
export function switchAccount(username) {
    const account = listAccounts().find(item => sameName(item.username, username));
    if (account) reloadAs(account.token);
}

// To the sign-in, while the accounts signed in so far stay remembered (and offered there)
export function addAnotherAccount() {
    reloadAs(null);
}

// A token the server refused (signed out everywhere, password changed elsewhere)
export function forgetToken(token) {
    if (token) store(listAccounts().filter(account => account.token !== token));
}
