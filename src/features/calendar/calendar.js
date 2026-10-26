// Date math and task helpers for the calendar. Days are local dates; a day is identified
// by its key "YYYY-MM-DD" (the same text <input type="date"> and the api use).
import { parseDate, toDateOnly, toInputDate, mondayIndex } from '../helperFunction';

export const CALENDAR_VIEWS = ['month', 'week', 'agenda'];

export const dateKey = (value) => toInputDate(value);

// "2026-10-20" -> local Date, null when it isn't a valid day
export function fromKey(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const date = parseDate(key);
    return date && dateKey(date) === key ? date : null;
}

export function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// Same day n months later; the 31st becomes the month's last day instead of spilling over
export function addMonths(date, months) {
    const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

export const startOfWeek = (date) => addDays(toDateOnly(date), -mondayIndex(date));
export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

// The 7 days (Monday to Sunday) of the week a day is in
export const weekDates = (date) => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i));

// All days of a day's month
export function monthDates(date) {
    const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(date.getFullYear(), date.getMonth(), i + 1));
}

// ISO 8601 week number: weeks start on Monday, week 1 holds the year's first Thursday
export function isoWeek(date) {
    const thursday = addDays(toDateOnly(date), 3 - mondayIndex(date));
    const firstThursday = new Date(thursday.getFullYear(), 0, 4);
    const weekOne = addDays(firstThursday, -mondayIndex(firstThursday));
    return 1 + Math.round((thursday - weekOne) / (7 * 24 * 3600 * 1000));
}

// Priority 0-100 as a level for the color of a task: 'high' | 'medium' | 'low' | null
export function prioLevel(prio) {
    if (prio === null || prio === undefined || prio === '') return null;
    const value = Number(prio);
    if (Number.isNaN(value)) return null;
    if (value >= 67) return 'high';
    if (value >= 34) return 'medium';
    return 'low';
}

// ---------- time of day ----------

// "09:30" -> 570 minutes after midnight; null without a (valid) time
export function minutesOfDay(time) {
    const match = typeof time === 'string' && time.match(/^(\d{2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// 570 -> "09:30" (wraps past midnight)
export function timeText(minutes) {
    const day = ((minutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(day / 60)).padStart(2, '0')}:${String(day % 60).padStart(2, '0')}`;
}

// When a task starts: its day at its time (local), null for a task without a day or time
export function taskStart(task) {
    const day = parseDate(task?.due);
    const minutes = minutesOfDay(task?.due_time);
    if (!day || minutes === null) return null;
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
}

// A task's reminders, minutes before its start, sorted (also from an older answer of the api
// that only had reminder_minutes)
export function remindersOf(task) {
    if (Array.isArray(task?.reminders)) return [...task.reminders].sort((a, b) => a - b);
    const one = task?.reminder_minutes;
    return one === null || one === undefined ? [] : [Number(one)];
}

// "12:30", for an event with a length "12:30–14:00"; '' without a time. A task's duration is
// only the time planned for it, so a task shows its start alone.
export function taskTimeText(task) {
    const start = minutesOfDay(task?.due_time);
    if (start === null) return '';
    const duration = task.kind === 'event' ? Number(task.duration_minutes) || 0 : 0;
    return duration > 0 ? `${timeText(start)}–${timeText(start + duration)}` : timeText(start);
}

// 90 -> "1 h 30 min", 45 -> "45 min", 1440 -> "1 d"
export function durationText(minutes) {
    const total = Number(minutes) || 0;
    const d = Math.floor(total / 1440);
    const h = Math.floor((total % 1440) / 60);
    const m = total % 60;
    return [d && `${d} d`, h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ') || '0 min';
}

// Order within a day: open before done, tasks for the whole day before timed ones,
// timed ones by their time, then higher priority, then by name
export function compareTasks(a, b) {
    if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1;
    const timeA = minutesOfDay(a.due_time);
    const timeB = minutesOfDay(b.due_time);
    if ((timeA === null) !== (timeB === null)) return timeA === null ? -1 : 1;
    if (timeA !== timeB) return timeA - timeB;
    const prio = (Number(b.prio) || 0) - (Number(a.prio) || 0);
    if (prio !== 0) return prio;
    return String(a.name).localeCompare(String(b.name));
}

export const REPEATS = ['daily', 'weekly', 'monthly', 'yearly'];

// The day of the n-th repeat after `start` (n steps from the day itself, like the server,
// so the 31st stays the 31st where the month has one)
export function repeatDate(start, repeat, n) {
    if (repeat === 'daily') return addDays(start, n);
    if (repeat === 'weekly') return addDays(start, 7 * n);
    if (repeat === 'monthly') return addMonths(start, n);
    if (repeat === 'yearly') return addMonths(start, 12 * n);
    return null;
}

// Previews of the coming repeats of open repeating tasks, up to `until` (a Date): copies with
// projected: true, the day as due, repeatOf: the real task and repeatStep: how many steps of its
// rhythm away. They are not stored anywhere; the server creates each one when the one before it
// is done. Like there, a task with an end (repeat_left) stops after that many steps, and the days
// deleted on their own (repeat_skip) are left out, but still count as a step.
const MAX_PREVIEWS = 400;
export function projectRepeats(tasks, until) {
    const previews = [];
    for (const task of tasks) {
        if (task.done || !REPEATS.includes(task.repeat) || !task.due) continue;
        const start = parseDate(dateKey(task.due));
        const skipped = new Set(task.repeat_skip ?? []);
        const steps = Number.isInteger(task.repeat_left) ? Math.min(task.repeat_left, MAX_PREVIEWS) : MAX_PREVIEWS;
        for (let n = 1; n <= steps; n++) {
            const date = repeatDate(start, task.repeat, n);
            if (date > until) break;
            const key = dateKey(date);
            if (skipped.has(key)) continue;
            previews.push({ ...task, id: `${task.id}@${key}`, due: key, projected: true, repeatOf: task, repeatStep: n });
        }
    }
    return previews;
}

// { "2026-10-20": [tasks sorted], ... } for the tasks that have a day
export function groupByDay(tasks) {
    const days = {};
    for (const task of tasks) {
        const key = dateKey(task.due);
        if (!key) continue;
        (days[key] ??= []).push(task);
    }
    for (const key of Object.keys(days)) days[key].sort(compareTasks);
    return days;
}

// Filters from the calendar toolbar: group id (or 'all'), whether done tasks show, search text
export function filterTasks(tasks, { groupId = 'all', showDone = true, query = '' } = {}) {
    const needle = query.trim().toLowerCase();
    return tasks.filter(task =>
        (showDone || !task.done)
        && (groupId === 'all' || (task.group_ids ?? []).includes(groupId))
        && (!needle || [task.name, task.description, task.location, task.details]
            .some(text => String(text ?? '').toLowerCase().includes(needle))));
}

// Focus time per day from the saved solo sessions (totalTime is in seconds):
// { "2026-10-20": { seconds, sessions: [...] } }
export function focusByDay(sessions) {
    const days = {};
    for (const session of sessions ?? []) {
        const key = dateKey(session.date);
        if (!key) continue;
        const day = (days[key] ??= { seconds: 0, sessions: [] });
        day.seconds += session.totalTime ?? 0;
        day.sessions.push(session);
    }
    return days;
}

// 2700 -> "45 min", 5400 -> "1 h 30 min", short form "1h 30" for the small day cells
export function formatFocus(seconds, short = false) {
    const minutes = Math.round((seconds ?? 0) / 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (short) return h > 0 ? `${h}h${m ? ` ${m}` : ''}` : `${m}m`;
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

// The view the calendar opened with last time, remembered in the browser
export function readStoredCalendarView() {
    try {
        const stored = localStorage.getItem('calendarView');
        return CALENDAR_VIEWS.includes(stored) ? stored : 'month';
    } catch {
        return 'month';
    }
}

export function storeCalendarView(view) {
    try { localStorage.setItem('calendarView', view); } catch { /* only for this visit */ }
}

// ---------- iCalendar export ----------

// Text values escape backslash, ; , and line breaks (RFC 5545 3.3.11)
const icsText = (value) => String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');

// Lines longer than 75 bytes continue on the next line after a space; umlauts and emoji
// are never split in the middle
function foldLine(line) {
    const encoder = new TextEncoder();
    const parts = [];
    let current = '';
    let bytes = 0;
    for (const char of line) {
        const size = encoder.encode(char).length;
        const limit = parts.length === 0 ? 75 : 74; // the leading space counts on later lines
        if (bytes + size > limit) {
            parts.push(current);
            current = '';
            bytes = 0;
        }
        current += char;
        bytes += size;
    }
    parts.push(current);
    return parts.join('\r\n ');
}

const icsDay = (date) => dateKey(date).replace(/-/g, '');
const icsStamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// local ("floating") time: shows at that time in whatever time zone the calendar is in
const icsLocalTime = (date) => `${icsDay(date)}T${timeText(date.getHours() * 60 + date.getMinutes()).replace(':', '')}00`;

// a timed task without a duration still needs an end
const DEFAULT_EVENT_MINUTES = 30;

// Tasks with a day as events, for Google Calendar, Outlook or Apple Calendar: all-day without
// a time, otherwise from the time for its duration, with location, link and its reminders (an
// all-day one's count from my all-day time, allDayTime "HH:MM").
// Done tasks keep their day and get a tick in front of the name.
export function toIcs(tasks, { now = new Date(), groupName, allDayTime = '12:00' } = {}) {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Quidey//Tasks//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];
    for (const task of tasks) {
        const day = parseDate(task.due);
        if (!day) continue;
        const description = [task.description, task.details, groupName?.(task)].filter(Boolean).join('\n');
        const start = taskStart(task);
        const when = start
            ? [
                `DTSTART:${icsLocalTime(start)}`,
                `DTEND:${icsLocalTime(new Date(start.getTime() + (Number(task.duration_minutes) || DEFAULT_EVENT_MINUTES) * 60000))}`,
            ]
            : [`DTSTART;VALUE=DATE:${icsDay(day)}`, `DTEND;VALUE=DATE:${icsDay(addDays(day, 1))}`];
        const summary = icsText(`${task.done ? '✓ ' : ''}${task.name}`);
        // an alarm counts from DTSTART, for an all-day one midnight: my all-day time is added
        const offset = start ? 0 : minutesOfDay(allDayTime) ?? 720;
        const alarms = task.done ? [] : remindersOf(task).flatMap(minutes => {
            const trigger = offset - minutes;
            return ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${summary}`, `TRIGGER:${trigger < 0 ? '-' : ''}PT${Math.abs(trigger)}M`, 'END:VALARM'];
        });
        lines.push(
            'BEGIN:VEVENT',
            `UID:quidey-task-${task.id}@quidey`,
            `DTSTAMP:${icsStamp(now)}`,
            ...when,
            `SUMMARY:${summary}`,
            ...(description ? [`DESCRIPTION:${icsText(description)}`] : []),
            ...(task.location ? [`LOCATION:${icsText(task.location)}`] : []),
            ...(task.link ? [`URL:${task.link}`] : []),
            start ? 'TRANSP:OPAQUE' : 'TRANSP:TRANSPARENT',
            ...alarms,
            'END:VEVENT',
        );
    }
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
}
