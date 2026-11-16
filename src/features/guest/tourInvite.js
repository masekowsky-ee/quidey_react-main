import { useSyncExternalStore } from 'react';

// The quiet card on the start page that offers visitors without an account the short tour
// (components/guest/GuestTourInvite.jsx). Once they answered it, or opened the tour any way, it
// stays away on this device (localStorage guestTourInvite = 'done').
const KEY = 'guestTourInvite';
const listeners = new Set();
let doneHere = false; // also when storage is blocked: it stays away for this visit

const read = () => {
    try { return doneHere || localStorage.getItem(KEY) === 'done'; } catch { return doneHere; }
};

export function markInviteDone() {
    doneHere = true;
    try { localStorage.setItem(KEY, 'done'); } catch { /* storage blocked: only this visit */ }
    listeners.forEach((listener) => listener());
}

// tests start every visit afresh
export function resetInviteForTests() {
    doneHere = false;
    listeners.forEach((listener) => listener());
}

const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export const useInviteDone = () => useSyncExternalStore(subscribe, read);
