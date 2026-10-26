import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { showToast } from '../toast/toast';
import { fill } from '../helperFunction';
import { translate } from '../../i18n/useTranslation';
import { dateKey, taskStart, timeText } from '../calendar/calendar';
import { pushCovers } from '../pwa/push';

// Reminders work while the app is open: a toast, and a system notification when allowed.
// A reminder still shows when the app is opened late, until an hour after the task started.
// With push notifications on (features/pwa/push.js) the server's push is the system
// notification, so only the toast comes from here.
const CHECK_EVERY_MS = 20 * 1000;
const LATE_LIMIT_MS = 60 * 60 * 1000;
const STORAGE_KEY = 'shownReminders';
const MAX_REMEMBERED = 200;

// One key per reminder, so changing the day, time or reminder of a task reminds again
export const reminderKey = (task) => `${task.id}|${dateKey(task.due)}|${task.due_time}|${task.reminder_minutes}`;

// When to remind about a task, or null (no time, no reminder, or done)
export function reminderAt(task) {
    const start = taskStart(task);
    if (!start || task.done || task.reminder_minutes === null || task.reminder_minutes === undefined) return null;
    return new Date(start.getTime() - Number(task.reminder_minutes) * 60000);
}

// The tasks whose reminder is due now and wasn't shown yet
export function dueReminders(tasks, now, shown) {
    return tasks.filter(task => {
        const at = reminderAt(task);
        return at && at <= now && now - taskStart(task) < LATE_LIMIT_MS && !shown.has(reminderKey(task));
    });
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

// Watches my tasks and shows their reminders when they are due
export function useTaskReminders(enabled = true) {
    const dispatch = useDispatch();
    const tasks = useSelector(state => state.task.tasks);
    const language = useSelector(state => state.settings.language);

    useEffect(() => {
        if (!enabled) return;
        const check = () => {
            const shown = readShown();
            const due = dueReminders(tasks, new Date(), shown);
            for (const task of due) {
                const start = taskStart(task);
                const time = timeText(start.getHours() * 60 + start.getMinutes());
                const text = fill(translate(language, 'reminderToast'), { name: task.name, time });
                shown.add(reminderKey(task));
                dispatch(showToast(text, 'info'));
                notify(task.name, text, reminderKey(task));
            }
            if (due.length > 0) storeShown(shown);
        };
        check();
        const interval = setInterval(check, CHECK_EVERY_MS);
        return () => clearInterval(interval);
    }, [enabled, tasks, language, dispatch]);
}
