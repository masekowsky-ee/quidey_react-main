import { createExternalStore } from '../externalStore';
import { REPEATS } from '../calendar/calendar';

// Deleting a repeating task asks what goes: only this one, this one and the following, or all
// of them. askDeleteScope(task) opens the question (DeleteScopeDialog, mounted once in the app
// shell) and resolves with 'one' | 'following' | 'all', or null when it was cancelled.

const store = createExternalStore(null);

// A task that is part of a row of repeats: it repeats, or it's a preview of a coming repeat
export const isRepeating = (task) => Boolean(task?.projected || REPEATS.includes(task?.repeat));

export function askDeleteScope(task) {
    // a question still open is answered "cancel" first
    store.get()?.resolve(null);
    return new Promise((resolve) => {
        store.set({ task, resolve });
    });
}

export function answerDeleteScope(scope) {
    const current = store.get();
    store.set(null);
    current?.resolve(scope);
}

// The open question: { task } or null
export const useDeleteScopeQuestion = store.use;
