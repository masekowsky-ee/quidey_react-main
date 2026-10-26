// The first days of a new account: after the intro tour "what do you want to do first?", after a
// few things done whether to install Quidey, and after about ten whether they like it.
//
// Only for accounts whose tour opened by itself (a new registration, see markTourSeen), counted
// on the device that showed it: localStorage `onboarding:<username>` =
// { actions, installAsked, ratingAsked }. Every task created or ticked off, group, friend request,
// friend, shared session or family counts as one (noteAction, called from the actions that make
// them). Never two questions at once, and none while the push question is open.
import { useSyncExternalStore } from 'react';
import { apiFetch } from '../helperFunction';
import { installState } from '../pwa/install';
import { pushAsking } from '../pwa/push';

// the install question comes from this action on (while the browser can install Quidey)
export const INSTALL_AFTER = 3;
// the rating question comes with the first success after this many actions
export const RATING_AFTER = 10;
// what counts as a success: a task done, a new friend
const SUCCESSES = ['done', 'friend'];
// a moment for the tick and its toast before the rating question comes
export const RATING_DELAY_MS = 1200;

// asking: null | 'next' (what first) | 'install' | 'rating'
let state = { asking: null };
let account = null;
let ratingTimer = null;
const listeners = new Set();
const set = (changes) => {
    state = { ...state, ...changes };
    listeners.forEach((listener) => listener());
};

const key = (username) => `onboarding:${username}`;

const load = () => {
    if (!account) return null;
    try {
        const record = JSON.parse(localStorage.getItem(key(account)));
        return record && typeof record.actions === 'number' ? record : null;
    } catch {
        return null;
    }
};

const save = (record) => {
    try { localStorage.setItem(key(account), JSON.stringify(record)); } catch { /* blocked storage: only this visit */ }
};

// The account signed in right now (App shell); another account has its own questions
export function setOnboardingAccount(username) {
    if (username === account) return;
    account = username ?? null;
    clearTimeout(ratingTimer);
    set({ asking: null });
}

// The tour opened by itself: this account is new, its first steps are followed from here on
export function startOnboarding(username) {
    setOnboardingAccount(username);
    if (account && !load()) save({ actions: 0, installAsked: false, ratingAsked: false });
}

// The tour of a new account was closed: what now?
export function askNextSteps() {
    if (load()) set({ asking: 'next' });
}

// Something was done (kind: 'task', 'done', 'group', 'friendRequest', 'friend', 'session', 'family')
export function noteAction(kind) {
    const record = load();
    if (!record) return;
    record.actions += 1;
    save(record);
    if (state.asking || pushAsking()) return;

    if (!record.ratingAsked && record.actions > RATING_AFTER && SUCCESSES.includes(kind)) {
        save({ ...record, ratingAsked: true });
        clearTimeout(ratingTimer);
        ratingTimer = setTimeout(() => {
            if (!state.asking && !pushAsking()) set({ asking: 'rating' });
        }, RATING_DELAY_MS);
        return;
    }
    // only where the settings can really install it (a browser prompt, or the share menu on iOS)
    if (!record.installAsked && record.actions >= INSTALL_AFTER && ['prompt', 'ios'].includes(installState())) {
        save({ ...record, installAsked: true });
        set({ asking: 'install' });
    }
}

// The open question is answered or closed
export function closeOnboarding() {
    set({ asking: null });
}

// "Gefällt dir Quidey?": { liked: true, stars: 1-5, message? } or { liked: false, message }.
// Mailed like other feedback. Rejects with the API error (error.code: INVALID_MESSAGE, RATE_LIMITED, SEND_FAILED).
export const sendRating = ({ liked, stars, message = '' }) =>
    apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ category: 'rating', liked, ...(liked ? { stars } : {}), message }),
    });

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useOnboarding = () => useSyncExternalStore(subscribe, () => state, () => state);

// Only for tests: back to the start
export function resetOnboarding() {
    clearTimeout(ratingTimer);
    account = null;
    state = { asking: null };
}
