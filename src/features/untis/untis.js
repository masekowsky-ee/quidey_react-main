// The timetable from WebUntis in my calendar (branch pro-features, later Quidey Pro; backend untis.js).
// Connected in Settings → Planen → Stundenplan (Untis); the calendar shows the lessons read-only
// beside my own entries (can be hidden: localStorage untisShow 'off'). Lessons become entries with
// a `lesson` field, which the calendar's views leave alone (no dragging, no editor, not in the agenda).

import { useEffect, useState, useSyncExternalStore } from 'react';
import { apiFetch } from '../helperFunction';
import { minutesOfDay } from '../calendar/calendar';

export const fetchUntisStatus = () => apiFetch('/api/untis');
export const searchUntisSchools = (q) => apiFetch(`/api/untis/schools?q=${encodeURIComponent(q)}`);
export const connectUntis = (body) => apiFetch('/api/untis', { method: 'PUT', body: JSON.stringify(body) });
export const disconnectUntis = () => apiFetch('/api/untis', { method: 'DELETE' });
export const syncUntis = () => apiFetch('/api/untis/sync', { method: 'POST' });
export const setHomeworkToTasks = (on) => apiFetch('/api/untis/settings', { method: 'PUT', body: JSON.stringify({ homeworkToTasks: on }) });
export const fetchUntisLessons = (from, to) => apiFetch(`/api/untis/lessons?from=${from}&to=${to}`);

// lessons as calendar entries (events with a time, read-only)
export function lessonsToEntries(lessons) {
    return (lessons ?? []).map(lesson => ({
        id: `lesson-${lesson.id}`,
        lesson: { status: lesson.status, info: lesson.info, subjectLong: lesson.subjectLong, className: lesson.className },
        kind: 'event',
        name: lesson.subjectLong || lesson.subject,
        due: lesson.day,
        due_time: lesson.start,
        duration_minutes: Math.max(1, minutesOfDay(lesson.end) - minutesOfDay(lesson.start)),
        location: lesson.room,
        description: '',
        done: false,
        prio: null,
        color: null,
        group_ids: [],
    }));
}

const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// a day's lessons as ONE entry from the first start to the last end (the calendar shows that; the
// day panel opens it to the lessons): { lesson: { box: true, items: [lesson entries], status } }
export function lessonBoxes(entries, name) {
    const days = new Map();
    for (const entry of entries) days.set(entry.due, [...(days.get(entry.due) ?? []), entry]);
    return [...days.entries()].map(([day, items]) => {
        const start = Math.min(...items.map(item => toMin(item.due_time)));
        const end = Math.max(...items.map(item => toMin(item.due_time) + item.duration_minutes));
        return {
            ...items[0],
            id: `lessonbox-${day}`,
            name,
            due: day,
            due_time: toHhmm(start),
            duration_minutes: end - start,
            location: '',
            lesson: { box: true, items, status: items.every(item => item.lesson.status === 'cancelled') ? 'cancelled' : 'normal', info: '', subjectLong: name, className: '' },
        };
    });
}

// showing them in the calendar (on unless switched off)
const SHOW_KEY = 'untisShow';
const listeners = new Set();
const readShow = () => { try { return localStorage.getItem(SHOW_KEY) !== 'off'; } catch { return true; } };
export function setShowLessons(on) {
    try { localStorage.setItem(SHOW_KEY, on ? 'on' : 'off'); } catch { /* only for this visit */ }
    listeners.forEach(listener => listener());
}
export const useShowLessons = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, readShow, readShow);

// the connection, asked once while the app runs (Settings changes it with rememberUntisStatus)
let status = null;
let loading = null;
const statusListeners = new Set();
// (null: not known, asked again by the next one who needs it)
export function rememberUntisStatus(next) {
    status = next;
    loading = next ? Promise.resolve(next) : null;
    statusListeners.forEach(listener => listener());
}
function loadStatus() {
    loading ??= Promise.resolve().then(fetchUntisStatus).then(answer => { rememberUntisStatus(answer ?? null); return answer; }).catch(() => { loading = null; return null; });
    return loading;
}
export function useUntisStatus() {
    useEffect(() => { loadStatus(); }, []);
    return useSyncExternalStore((l) => { statusListeners.add(l); return () => statusListeners.delete(l); }, () => status, () => status);
}

// the lessons from `from` to `to` (YYYY-MM-DD, ≤ 62 days) as calendar entries; [] while off,
// not connected or loading. Asked again every few minutes while shown (the server fetches from
// WebUntis when its copy is older than 15 minutes).
export function useUntisLessons(enabled, from, to) {
    const connected = useUntisStatus()?.connected;
    const [entries, setEntries] = useState([]);
    const on = Boolean(enabled && connected);
    useEffect(() => {
        if (!on) return undefined;
        let live = true;
        const load = () => fetchUntisLessons(from, to)
            .then(answer => { if (live) setEntries(lessonsToEntries(answer?.lessons)); })
            .catch(() => {});
        load();
        const id = setInterval(load, 5 * 60 * 1000);
        return () => { live = false; clearInterval(id); };
    }, [on, from, to]);
    return on ? entries : [];
}
