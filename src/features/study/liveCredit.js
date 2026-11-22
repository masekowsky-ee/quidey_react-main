// Time studied, live. The server counts per session the larger of the focus time saved and the
// planned length once ticked off; what the focus timer has booked on a session but not yet saved
// (the running round) is added here, so a topic's figure moves while the timer runs.

import { useMemo } from 'react';
import { useSelector } from 'react-redux';

// 90 -> '1 h 30 min', 45 -> '45 min', 120 -> '2 h', 0 -> '0 min' (whole minutes; the unit words are the same in de / en)
export function formatDuration(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    if (hours === 0) return `${rest} min`;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// minutes studied on one session; liveMs: focus time not saved yet
export const sessionCredit = ({ focusMs, done, minutes }, liveMs = 0) =>
    Math.max(((focusMs || 0) + liveMs) / 60000, done ? minutes : 0);

// { [partId]: minutes studied } for a goal's parts: the credit the server counted plus what the running
// focus round (liveSeconds, per session task) has added since. A ticked-off part keeps its credit.
export function partCredits(goal, liveSeconds = {}) {
    const credits = {};
    for (const part of goal?.parts ?? []) credits[part.id] = part.credit ?? 0;
    const open = new Set((goal?.parts ?? []).filter(p => !p.doneAt).map(p => p.id));
    for (const s of goal?.sessions ?? []) {
        if (!open.has(s.partId) || !liveSeconds[s.taskId]) continue;
        credits[s.partId] += sessionCredit(s, liveSeconds[s.taskId] * 1000) - sessionCredit(s);
    }
    return credits;
}

// What is still to study of an estimate (never below 0; a ticked-off part has nothing left)
export const remainingMinutes = (estimate, credit, done = false) => (done ? 0 : Math.max(0, estimate - credit));

// Seconds booked on the goal's sessions by the running (unsaved) focus round: { [taskId]: seconds }.
// The selector answers a string, so a component re-renders only when a whole minute has been added.
export function useLiveSeconds(goals) {
    const ids = useMemo(() => new Set((Array.isArray(goals) ? goals : [goals]).flatMap(g => (g?.sessions ?? []).map(s => s.taskId))), [goals]);
    const key = useSelector(state => state.session.currentSessionData.workedTasks
        .filter(task => ids.has(task.id))
        .map(task => `${task.id}:${Math.floor(task.time / 60)}`)
        .join(','));
    return useMemo(() => Object.fromEntries(key ? key.split(',').map(pair => {
        const [id, minutes] = pair.split(':');
        return [Number(id), Number(minutes) * 60];
    }) : []), [key]);
}
