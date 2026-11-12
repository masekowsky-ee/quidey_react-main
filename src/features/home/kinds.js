import { useCallback, useState } from 'react';

// What Home's list shows: tasks, events, reminders, notes. All four at first; a tap switches one.
// Notes are read on their own: tapping Notizen leaves only the notes (tapped again: everything),
// and turning anything else on while only the notes show switches the notes off. The last one on
// can't be switched off (that is "everything" again).
export const HOME_KINDS = ['tasks', 'events', 'reminders', 'notes'];
const KEY = 'homeKinds';

export function toggleKind(active, kind) {
    const on = active.includes(kind);
    if (kind === 'notes') return on && active.length === 1 ? [...HOME_KINDS] : ['notes'];
    if (on) return active.length > 1 ? active.filter(k => k !== kind) : [...HOME_KINDS];
    return [...active.filter(k => k !== 'notes'), kind].sort((a, b) => HOME_KINDS.indexOf(a) - HOME_KINDS.indexOf(b));
}

function stored() {
    try {
        const list = JSON.parse(localStorage.getItem(KEY));
        if (Array.isArray(list)) {
            const kept = HOME_KINDS.filter(kind => list.includes(kind));
            if (kept.length > 0) return kept;
        }
    } catch { /* no storage: everything */ }
    return [...HOME_KINDS];
}

export function useHomeKinds() {
    const [active, setActive] = useState(stored);
    const toggle = useCallback((kind) => setActive(prev => {
        const next = toggleKind(prev, kind);
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not remembered */ }
        return next;
    }), []);
    return [active, toggle];
}
