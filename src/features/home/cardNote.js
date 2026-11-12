import { useSyncExternalStore } from 'react';

// The note shown in Home's white card instead of the task in focus (no timer, no focus link).
// Only its id is kept, on this device (localStorage `homeCardNote`); the task in focus and the
// timer are not touched by it. A small store, so the list that puts a note there and the card
// that shows it, in different places of the page, agree.
const KEY = 'homeCardNote';
const listeners = new Set();

function read() {
    try { return localStorage.getItem(KEY) || null; } catch { return null; }
}
let current = read();

function set(id) {
    current = id;
    try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* not remembered */ }
    listeners.forEach(listener => listener());
}

export const pinCardNote = (id) => set(String(id));
export const clearCardNote = () => set(null);

const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

// the id of the note in the card, or null
export const useCardNote = () => useSyncExternalStore(subscribe, () => current, () => null);
