// Tasks and events. A task has to be done: it is ticked off by hand. An event (an appointment,
// a shift, a lecture) happens on its day: it counts as done once it is over, and the server
// ticks it off by itself (also when nobody looks). Older tasks without a kind are tasks.
// duration_minutes is a task's planned time and an event's length.
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { parseDate } from '../helperFunction';
import { minutesOfDay } from '../calendar/calendar';
import { refreshTasks } from './taskAction';

export const TASK_KINDS = ['task', 'event'];

export const isEvent = (task) => task?.kind === 'event';

// Event types to start a list with (Settings and the editor offer them while the list is empty)
export const EVENT_TYPE_SUGGESTIONS = {
    de: [
        { name: 'Arbeit', color: 'blue' },
        { name: 'Vorlesung', color: 'violet' },
        { name: 'Lernen', color: 'teal' },
        { name: 'Sport', color: 'green' },
        { name: 'Termin', color: 'orange' },
        { name: 'Freizeit', color: 'pink' },
    ],
    en: [
        { name: 'Work', color: 'blue' },
        { name: 'Lecture', color: 'violet' },
        { name: 'Study', color: 'teal' },
        { name: 'Sport', color: 'green' },
        { name: 'Appointment', color: 'orange' },
        { name: 'Free time', color: 'pink' },
    ],
};

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The event type an entry's name points to by one of the type's keywords: { type, keyword } or
// null. A keyword counts where a word of the name starts with it, case aside: "Arbeit" finds
// "Arbeit", "Arbeitstreffen" and "Spät-Arbeit", not "Bearbeiten". The first type in the list wins.
export function matchEventType(name, types) {
    const text = String(name ?? '');
    if (!text.trim()) return null;
    for (const type of types ?? []) {
        for (const raw of type.keywords ?? []) {
            const keyword = raw.trim();
            if (!keyword) continue;
            if (new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(keyword)}`, 'iu').test(text)) return { type, keyword };
        }
    }
    return null;
}

// Translated message for an event type the api refused
export function eventTypeErrorText(t, err) {
    const key = `eventTypeError_${err?.code}`;
    return t(key) === key ? t('friendError_generic') : t(key);
}

// When an event is over, as a local Date: its start plus its length, or the end of its day
// when it has no time. null for a task or an event without a day.
export function eventEnd(task) {
    if (!isEvent(task)) return null;
    const day = parseDate(task.due);
    if (!day) return null;
    const start = minutesOfDay(task.due_time);
    if (start === null) return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, start + (Number(task.duration_minutes) || 0));
}

// Whether an event is going on right now
export function isEventNow(task, now = new Date()) {
    const end = eventEnd(task);
    if (!end || task.done) return false;
    const day = parseDate(task.due);
    const start = minutesOfDay(task.due_time);
    const begins = start === null ? day : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, start);
    return begins <= now && now < end;
}

// longest wait before looking again (timers far ahead drift and may never fire)
const MAX_WAIT_MS = 60 * 60 * 1000;

// While the app is open: when the next of my open events ends, the list is loaded again, so it
// shows as done right then (the server ticks it off; see GET /api/tasks)
export function useEventEnds(enabled = true) {
    const dispatch = useDispatch();
    const tasks = useSelector(state => state.task.tasks);
    // counts up when the longest wait ran out without an end: then it looks again
    const [round, setRound] = useState(0);
    useEffect(() => {
        if (!enabled) return undefined;
        const now = Date.now();
        const ends = tasks.filter(task => isEvent(task) && !task.done).map(task => eventEnd(task)?.getTime()).filter(Boolean);
        if (ends.length === 0) return undefined;
        const next = Math.min(...ends);
        // a little after the end, so the server sees it as over too
        const wait = Math.min(MAX_WAIT_MS, Math.max(1000, next - now + 2000));
        const id = setTimeout(() => {
            if (Date.now() >= next) dispatch(refreshTasks()).catch(() => {});
            else setRound(n => n + 1);
        }, wait);
        return () => clearTimeout(id);
    }, [enabled, tasks, dispatch, round]);
}
