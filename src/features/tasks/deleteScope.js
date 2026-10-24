import { useSyncExternalStore } from 'react';
import { REPEATS } from '../calendar/calendar';

// Deleting a repeating task asks what goes: only this one, this one and the following, or all
// of them. askDeleteScope(task) opens the question (DeleteScopeDialog, mounted once in the app
// shell) and resolves with 'one' | 'following' | 'all', or null when it was cancelled.

let pending = null;
const listeners = new Set();
const emit = () => listeners.forEach(listener => listener());

// A task that is part of a row of repeats: it repeats, or it's a preview of a coming repeat
export const isRepeating = (task) => Boolean(task?.projected || REPEATS.includes(task?.repeat));

export function askDeleteScope(task) {
    // a question still open is answered "cancel" first
    pending?.resolve(null);
    return new Promise((resolve) => {
        pending = { task, resolve };
        emit();
    });
}

export function answerDeleteScope(scope) {
    const current = pending;
    pending = null;
    emit();
    current?.resolve(scope);
}

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

// The open question: { task } or null
export const useDeleteScopeQuestion = () => useSyncExternalStore(subscribe, () => pending, () => null);
