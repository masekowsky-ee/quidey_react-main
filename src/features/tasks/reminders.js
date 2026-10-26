import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { showToast } from '../toast/toast';
import { playSound } from '../settings/sound';
import { apiFetch, fill, parseDate } from '../helperFunction';
import { translate } from '../../i18n/useTranslation';
import { dateKey, durationText, minutesOfDay, remindersOf, taskStart, timeText } from '../calendar/calendar';
import { pushCovers, pushRemindsByDefault } from '../pwa/push';
import { SET_ACCESS } from '../auth/authActionTypes';

// Reminders work while the app is open: a toast, and a system notification when allowed.
// A reminder still shows when the app is opened late, until an hour after the task started.
// With push notifications on (features/pwa/push.js) the server's push is the system
// notification, so only the toast comes from here.
//
// A task has a list of reminders (task.reminders): minutes before its start, 0 = at the start.
// A task without a time of day starts, for its reminders, at my all-day time (account setting,
// GET /api/me → allDayReminderTime, 12:00 until changed): "at the start" is that time on its
// day, "1 day before" that time the day before. The server pushes and mails by the same rules.
const CHECK_EVERY_MS = 20 * 1000;
const LATE_LIMIT_MS = 60 * 60 * 1000;
const STORAGE_KEY = 'shownReminders';
const MAX_REMEMBERED = 200;

export const DEFAULT_ALL_DAY_TIME = '12:00';
// at most this many per task (like the server)
export const REMINDERS_MAX = 5;

export const selectAllDayTime = (state) => state.auth.access.allDayReminderTime ?? DEFAULT_ALL_DAY_TIME;

export { remindersOf };

// The label of one reminder: "Zum Beginn", "15 min vorher"; for a task without a time
// "Am Tag", "1 Tag vorher", "2 Tage vorher", "1 Woche vorher"
export function reminderLabel(t, minutes, hasTime) {
    if (hasTime || minutes % 1440 !== 0) return minutes === 0 ? t('reminderAtStart') : fill(t('reminderBefore'), { time: durationText(minutes) });
    if (minutes === 0) return t('reminderOnTheDay');
    if (minutes === 10080) return t('reminderWeekBefore');
    return fill(t(minutes === 1440 ? 'reminderDayBefore' : 'reminderDaysBefore'), { count: minutes / 1440 });
}

// What new tasks start with: "at the start" while notifications come to this device
export const defaultReminders = () => (pushRemindsByDefault() ? [0] : []);

// Where a task's reminders count from: its start, or my all-day time on its day; null without a day
export function reminderBase(task, allDayTime = DEFAULT_ALL_DAY_TIME) {
    const timed = taskStart(task);
    if (timed) return timed;
    const day = parseDate(task?.due);
    const minutes = minutesOfDay(allDayTime) ?? minutesOfDay(DEFAULT_ALL_DAY_TIME);
    if (!day) return null;
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
}

// One key per reminder, so changing the day, time or reminders of a task reminds again
export const reminderKey = (task, minutes) => `${task.id}|${dateKey(task.due)}|${task.due_time}|${minutes}`;

// When to remind about a task: [{ minutes, at }] from the earliest; [] when done or without a day
export function reminderTimes(task, allDayTime) {
    const base = reminderBase(task, allDayTime);
    if (!base || task.done) return [];
    return remindersOf(task)
        .map(minutes => ({ minutes, at: new Date(base.getTime() - minutes * 60000) }))
        .sort((a, b) => a.at - b.at);
}

// The reminders due now and not shown yet, one per task (the latest; the ones before it count
// as shown with it): [{ task, minutes, at, start, keys }]
export function dueReminders(tasks, now, shown, allDayTime) {
    const due = [];
    for (const task of tasks) {
        const start = reminderBase(task, allDayTime);
        if (!start || now - start >= LATE_LIMIT_MS) continue;
        const ready = reminderTimes(task, allDayTime).filter(({ at }) => at <= now);
        const latest = ready[ready.length - 1];
        if (!latest || shown.has(reminderKey(task, latest.minutes))) continue;
        due.push({ task, ...latest, start, keys: ready.map(({ minutes }) => reminderKey(task, minutes)) });
    }
    return due;
}

function readShown() {
    try {
        const list = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
        return new Set(Array.isArray(list) ? list : []);
    } catch {
        return new Set();
    }
}

function storeShown(shown) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...shown].slice(-MAX_REMEMBERED))); } catch { /* only this visit */ }
}

// Asks for permission to show system notifications; called when a reminder is set (a click,
// which browsers require). Without permission the in-app toast still shows.
export function askForReminderPermission() {
    try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch?.(() => {});
    } catch { /* not supported */ }
}

function notify(title, body, tag) {
    if (pushCovers('plan')) return;
    try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, tag });
    } catch { /* not supported (e.g. some mobile browsers need a service worker) */ }
}

// My all-day time ("HH:MM"), saved for the account: pushes, mails and the app use it
export const saveAllDayTime = (time) => {
    return async (dispatch, getState) => {
        const data = await apiFetch('/api/users/reminder-time', { method: 'PUT', body: JSON.stringify({ time }) });
        dispatch({ type: SET_ACCESS, payload: { ...getState().auth.access, allDayReminderTime: data.allDayReminderTime } });
    };
};

// Watches my tasks and shows their reminders when they are due
export function useTaskReminders(enabled = true) {
    const dispatch = useDispatch();
    const tasks = useSelector(state => state.task.tasks);
    const language = useSelector(state => state.settings.language);
    const allDayTime = useSelector(selectAllDayTime);

    useEffect(() => {
        if (!enabled) return;
        const check = () => {
            const shown = readShown();
            const due = dueReminders(tasks, new Date(), shown, allDayTime);
            for (const { task, minutes, keys } of due) {
                const text = task.due_time
                    ? fill(translate(language, 'reminderToast'), { name: task.name, time: timeText(minutesOfDay(task.due_time)) })
                    : fill(translate(language, 'reminderToastAllDay'), { name: task.name });
                keys.forEach(key => shown.add(key));
                dispatch(showToast(text, 'info'));
                notify(task.name, text, reminderKey(task, minutes));
            }
            if (due.length > 0) {
                storeShown(shown);
                playSound('reminder');
            }
        };
        check();
        const interval = setInterval(check, CHECK_EVERY_MS);
        return () => clearInterval(interval);
    }, [enabled, tasks, language, allDayTime, dispatch]);
}
