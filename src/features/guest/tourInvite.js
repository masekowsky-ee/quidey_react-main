import { useSyncExternalStore } from 'react';
import { createListeners } from '../externalStore';
import { read as readSetting, write } from '../storedSetting';

// The quiet card on the start page that offers visitors without an account the short tour
// (components/guest/GuestTourInvite.jsx). Once they answered it, or opened the tour any way, it
// stays away on this device (localStorage guestTourInvite = 'done').
const KEY = 'guestTourInvite';
const { subscribe, notify } = createListeners();
let doneHere = false; // also when storage is blocked: it stays away for this visit

const read = () => doneHere || readSetting(KEY) === 'done';

export function markInviteDone() {
    doneHere = true;
    write(KEY, 'done');
    notify();
}

// tests start every visit afresh
export function resetInviteForTests() {
    doneHere = false;
    notify();
}

export const useInviteDone = () => useSyncExternalStore(subscribe, read);
