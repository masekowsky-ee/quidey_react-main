import { read, write } from '../storedSetting';

// What the app's own "it is time" checks (tasks/reminders.js, routines/routines.js) share. Each
// feature keeps its own late limit (how long after its time a reminder still shows: a task's 60
// minutes, a routine's 15), its own check and its own wording.

export function startChecking(check, everyMs) {
    check();
    const id = setInterval(check, everyMs);
    return () => clearInterval(id);
}

// "Already told" keys that survive a reload: a Set kept in localStorage under `key` (a JSON
// list), the last `max` of them
export function rememberedSet(key, max) {
    return {
        // a new Set every time: callers add to it
        read: () => read(key, {
            parse: (text) => {
                const list = JSON.parse(text ?? '[]');
                return new Set(Array.isArray(list) ? list : []);
            },
            fallback: null,
        }) ?? new Set(),
        save: (set) => write(key, JSON.stringify([...set].slice(-max))),
    };
}
