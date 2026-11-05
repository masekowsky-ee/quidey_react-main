// Reminders (testers only for now): a text and a time, no task. Once at a point in time, or on
// weekdays (1 = Monday) at a time of day. They live in Postfach → Erinnerungen, the new-task form
// makes them ("Erinnerung" switch), the command bar has "Neue Erinnerung". API under
// /api/tester/reminders (the server pushes them at their time, utils/focus.js).
//
// When one is due: in the Android app it rings natively like an alarm clock, full screen over the
// lock screen (features/native/alarms.js, plugin QuideyAlarms); in the browser, while the app is
// open, ReminderAlert covers the page, else the push comes.
//
// Times here are the device's local time; the server works them out in users.timezone, which
// the app keeps equal to the device's (useAccountLocale).

import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { apiFetch } from '../helperFunction';
import { useRealtime, useSafetyPoll } from '../realtime/socket';
import { useIsTester } from '../auth/tester';
import { isoWeekday } from '../routines/routines';
import { LOGOUT } from '../auth/authActionTypes';

const SET_REMINDERS = 'SET_REMINDERS';
const REMINDER_SAVED = 'REMINDER_SAVED';
const REMINDER_REMOVED = 'REMINDER_REMOVED';
const RESET_REMINDERS = 'RESET_REMINDERS';

export const REMINDER_TEXT_MAX = 200;
export const SNOOZE_MINUTES = 10;
// a due reminder still shows (and rings) this long after its time, like the server's limit
export const LATE_LIMIT_MS = 10 * 60 * 1000;

export default function remindersReducer(state = { list: [], loaded: false }, action) {
    switch (action.type) {
        case SET_REMINDERS:
            return { list: action.payload, loaded: true };
        case REMINDER_SAVED: {
            const exists = state.list.some(reminder => reminder.id === action.payload.id);
            return {
                ...state,
                list: exists ? state.list.map(reminder => reminder.id === action.payload.id ? action.payload : reminder) : [...state.list, action.payload],
            };
        }
        case REMINDER_REMOVED:
            return { ...state, list: state.list.filter(reminder => reminder.id !== action.payload) };
        case RESET_REMINDERS:
        case LOGOUT:
            return { list: [], loaded: false };
        default:
            return state;
    }
}

export const selectReminders = (state) => state.reminders.list;

export const fetchReminders = () => async (dispatch) => {
    const list = await apiFetch('/api/tester/reminders');
    dispatch({ type: SET_REMINDERS, payload: list });
    return list;
};

// { id?, text, at } (once, a Date or ISO string) | { id?, text, days, atTime } (weekly)
export const saveReminder = (reminder) => async (dispatch) => {
    const body = JSON.stringify(reminder.days
        ? { text: reminder.text, days: reminder.days, atTime: reminder.atTime }
        : { text: reminder.text, at: new Date(reminder.at).toISOString() });
    const saved = reminder.id
        ? await apiFetch(`/api/tester/reminders/${reminder.id}`, { method: 'PATCH', body })
        : await apiFetch('/api/tester/reminders', { method: 'POST', body });
    dispatch({ type: REMINDER_SAVED, payload: saved });
    return saved;
};

export const deleteReminder = (id) => async (dispatch) => {
    await apiFetch(`/api/tester/reminders/${id}`, { method: 'DELETE' });
    dispatch({ type: REMINDER_REMOVED, payload: id });
};

export const reminderDone = (id) => async (dispatch) => {
    const saved = await apiFetch(`/api/tester/reminders/${id}/done`, { method: 'POST' });
    dispatch({ type: REMINDER_SAVED, payload: saved });
    return saved;
};

export const snoozeReminder = (id, minutes = SNOOZE_MINUTES) => async (dispatch) => {
    const saved = await apiFetch(`/api/tester/reminders/${id}/snooze`, { method: 'POST', body: JSON.stringify({ minutes }) });
    dispatch({ type: REMINDER_SAVED, payload: saved });
    return saved;
};

// ---------- when it rings ----------

export const isWeekly = (reminder) => Array.isArray(reminder?.days) && reminder.days.length > 0;
export const isDone = (reminder) => Boolean(reminder?.doneAt);

function atTimeOn(day, atTime) {
    const [h, m] = atTime.split(':').map(Number);
    const at = new Date(day);
    at.setHours(h, m, 0, 0);
    return at;
}

// Every time it rings between `from` and `to` (Dates), in order: the snooze, the once time, the
// weekdays' times. A done reminder rings no more.
export function occurrences(reminder, from, to) {
    if (!reminder || isDone(reminder)) return [];
    const times = [];
    const snooze = reminder.snoozedUntil ? new Date(reminder.snoozedUntil) : null;
    if (snooze) times.push(snooze);
    if (isWeekly(reminder) && reminder.atTime) {
        const day = new Date(from);
        day.setHours(0, 0, 0, 0);
        for (; day <= to; day.setDate(day.getDate() + 1)) {
            if (!reminder.days.includes(isoWeekday(day))) continue;
            times.push(atTimeOn(day, reminder.atTime));
        }
    } else if (reminder.at && !snooze) {
        // a snoozed once reminder rings at the snooze instead of its own time
        times.push(new Date(reminder.at));
    }
    return times
        .filter(at => at >= from && at <= to)
        .sort((a, b) => a - b)
        .filter((at, i, list) => i === 0 || at.getTime() !== list[i - 1].getTime());
}

// The next time it rings from `now` on, or null
export function nextOccurrence(reminder, now = new Date()) {
    const horizon = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    if (!isWeekly(reminder)) {
        const once = occurrences(reminder, now, new Date(8640000000000000));
        return once[0] ?? null;
    }
    return occurrences(reminder, now, horizon)[0] ?? null;
}

// Ringing right now: its time came within LATE_LIMIT_MS (and it isn't done)
export function dueOccurrence(reminder, now = new Date()) {
    const recent = occurrences(reminder, new Date(now.getTime() - LATE_LIMIT_MS), now);
    return recent.at(-1) ?? null;
}

// A once reminder whose time is over without "Erledigt": shown as missed until confirmed
export const isMissed = (reminder, now = new Date()) => !isDone(reminder) && !isWeekly(reminder)
    && !dueOccurrence(reminder, now) && nextOccurrence(reminder, now) === null;

// "Mo, Mi, Fr · 07:30", every day / Monday to Friday in words
export function weekdaysText(reminder, t) {
    const days = reminder.days.length === 7 ? t('routineEveryDay')
        : reminder.days.join() === '1,2,3,4,5' ? t('routineWeekdays')
        : reminder.days.map(day => t('weekDays', day - 1)).join(', ');
    return `${days} · ${reminder.atTime}`;
}

// open ones by their next time (missed first), then the done ones
export function sortReminders(list, now = new Date()) {
    const rank = (reminder) => {
        if (isDone(reminder)) return [3, -new Date(reminder.doneAt).getTime()];
        const due = dueOccurrence(reminder, now);
        if (due) return [0, due.getTime()];
        if (isMissed(reminder, now)) return [1, new Date(reminder.at).getTime()];
        return [2, nextOccurrence(reminder, now)?.getTime() ?? Infinity];
    };
    return [...list].sort((a, b) => {
        const [ra, ta] = rank(a);
        const [rb, tb] = rank(b);
        return ra - rb || ta - tb;
    });
}

// ---------- loaded app-wide for testers ----------
const REFRESH_MS = 60 * 1000;

export function useReminders(allowed) {
    const dispatch = useDispatch();
    const isTester = useIsTester();
    const enabled = Boolean(allowed && isTester);
    const list = useSelector(selectReminders);
    const loaded = useSelector(state => state.reminders.loaded);
    const language = useSelector(state => state.settings.language);

    useSafetyPoll(() => dispatch(fetchReminders()).catch(() => {}), { everyMs: REFRESH_MS, enabled, immediately: true });
    useRealtime('reminders:changed', () => { if (enabled) dispatch(fetchReminders()).catch(() => {}); });

    // the Android app rings them itself: every change goes to its alarm clock
    const key = useMemo(() => JSON.stringify(list.map(r => [r.id, r.text, r.at, r.days, r.atTime, r.snoozedUntil, r.doneAt])), [list]);
    useEffect(() => {
        if (!enabled || !loaded) return;
        import('../native/alarms').then(({ syncAlarms }) => syncAlarms(list, language)).catch(() => {});
        // key stands for the list's content
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, loaded, key, language]);

    // what was tapped on the alarm while the app was closed goes to the server
    useEffect(() => {
        if (!enabled) return undefined;
        const take = () => import('../native/alarms').then(({ sendAlarmActions }) => sendAlarmActions(dispatch)).catch(() => {});
        take();
        window.addEventListener('focus', take);
        return () => window.removeEventListener('focus', take);
    }, [enabled, dispatch]);
}

export const resetReminders = () => ({ type: RESET_REMINDERS });
