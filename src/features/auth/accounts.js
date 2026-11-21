// Several accounts signed in on one device, switched with one tap. Each keeps its own sign-in
// token in localStorage 'accounts' as [{ username, displayName, token, avatar? }]; 'token' is the one in
// use (the rest of the app only knows that one). `avatar`: the profile picture as a small data
// address, kept so the switcher can show the other accounts' pictures (only friends may load them
// from the server). Nothing leaves the device.
// Switching loads the app again, so no list, socket or timer of the other account stays behind.
import { session } from '../api/session';
import { read, write, remove } from '../storedSetting';
import { teardownAccount } from './teardown';

const KEY = 'accounts';
export const MAX_ACCOUNTS = 5;

// settings that belong to one account, not to the device: they go when the account changes
const PER_ACCOUNT_KEYS = ['teamSessionId'];

const sameName = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

export const listAccounts = () => read(KEY, {
    parse: (text) => {
        const list = JSON.parse(text ?? '[]');
        return Array.isArray(list)
            ? list.filter(account => account && typeof account.username === 'string' && typeof account.token === 'string')
            : [];
    },
    fallback: [],
});

function store(list) {
    if (list.length === 0) remove(KEY);
    else write(KEY, JSON.stringify(list.slice(0, MAX_ACCOUNTS)));
}

// Adds an account or updates its token / name; it keeps its place in the list
export function rememberAccount({ username, token, displayName, avatar }) {
    if (!username || !token) return;
    const list = listAccounts();
    const index = list.findIndex(account => sameName(account.username, username));
    const known = index >= 0 ? list[index] : null;
    const next = { username, token, displayName: displayName ?? known?.displayName ?? null };
    const picture = avatar === undefined ? known?.avatar : avatar;
    if (picture) next.avatar = picture;
    if (index >= 0) list[index] = next;
    else list.push(next);
    store(list);
}

export function forgetAccount(username) {
    store(listAccounts().filter(account => !sameName(account.username, username)));
}

export const currentToken = () => session.token();

// The accounts other than the one in use
export const otherAccounts = (username) => listAccounts().filter(account => !sameName(account.username, username));

function reloadAs(token) {
    // usage events, focus run and alarms belong to the account that made them: gone before the token changes
    teardownAccount({ freezeFocus: true });
    try {
        if (token) session.set(token);
        else session.clear();
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
