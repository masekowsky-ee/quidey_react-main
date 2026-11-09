// Reminders as an alarm clock in the Android app: the app's plugin "QuideyAlarms"
// (android/…/AlarmsPlugin.java in quidey_android) sets each coming time with Android's
// AlarmManager.setAlarmClock (exact, also with the phone asleep and offline). At the time a
// notification with a full-screen intent opens AlarmActivity over the lock screen: it rings and
// vibrates until "Erledigt" or "10 min später". What was tapped there is kept on the device and
// sent to the server the next time the app runs (sendAlarmActions).
//
// While this device rings them itself the server pushes it none of them (PUT
// /api/tester/reminders/device { endpoint, alarms }). Without exact alarms allowed it says so,
// and the server's push comes instead.
//
// In the browser, or in an older app without the plugin, every function does nothing.

import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './native';
import { apiFetch } from '../helperFunction';
import { translate } from '../../i18n/useTranslation';
import { occurrences, fetchReminders, SNOOZE_MINUTES } from '../reminders/reminders';

const QuideyAlarms = registerPlugin('QuideyAlarms');

// how far ahead the alarms are set (each sync replaces them all; the app runs again long before)
const AHEAD_MS = 14 * 24 * 60 * 60 * 1000;
// Android allows a few hundred alarms per app; plenty below that
const MAX_ALARMS = 100;

let available = null; // null: not asked yet
let lastStatus = null;

// { exact, fullScreen, notifications } (each true/false), or null: no alarms here
export async function alarmStatus() {
    if (!isNativeApp() || available === false) return null;
    try {
        lastStatus = await QuideyAlarms.status();
        available = true;
        return lastStatus;
    } catch {
        // an app built before the plugin
        available = false;
        return null;
    }
}

// Rings this device reminders itself? (then the page's own alert stays away.) In the app, until
// the plugin has answered, it counts as yes: an alert and a ringing alarm at once would be worse.
export const ringsNatively = () => isNativeApp() && (available === null || Boolean(available && lastStatus?.exact));

// which: 'exact' | 'fullScreen' | 'notifications': Android's page to allow it
export function openAlarmSettings(which) {
    if (!isNativeApp()) return Promise.resolve();
    return QuideyAlarms.openSettings({ which }).catch(() => {});
}

// The coming times of every reminder, at most MAX_ALARMS, soonest first
export function alarmsFor(list, now = new Date()) {
    const to = new Date(now.getTime() + AHEAD_MS);
    return list
        .flatMap(reminder => occurrences(reminder, now, to).map(at => ({ reminderId: reminder.id, text: reminder.text, at: at.getTime() })))
        .sort((a, b) => a.at - b.at)
        .slice(0, MAX_ALARMS);
}

async function tellServer(alarms) {
    const endpoint = localStorage.getItem('pushEndpoint');
    if (!endpoint) return;
    await apiFetch('/api/tester/reminders/device', { method: 'PUT', body: JSON.stringify({ endpoint, alarms }) }).catch(() => {});
}

// Sets this device's alarms to the reminders' coming times (replacing all set before)
export async function syncAlarms(list, language) {
    const status = await alarmStatus();
    if (!status) return;
    const t = (key) => translate(language, key);
    await QuideyAlarms.schedule({
        alarms: alarmsFor(list),
        labels: {
            title: t('reminderAlarmTitle'),
            done: t('reminderDone'),
            snooze: t('reminderSnooze'),
            channel: t('reminderChannel'),
            channelQuiet: t('reminderChannelQuiet'),
        },
        snoozeMinutes: SNOOZE_MINUTES,
    }).catch(() => {});
    await tellServer(Boolean(status.exact));
}

// Signing out (or another account taking over): none of this account's alarms ring here any more
export async function cancelAlarms() {
    if (!isNativeApp() || available === false) return;
    await QuideyAlarms.cancelAll().catch(() => {});
}

// "Erledigt" / "Später" tapped on the alarm (also while the app was closed or offline): to the
// server, then the list again (it changed). Each is taken off the device only once the server
// has it (or the reminder is gone there); offline they wait for the next start.
let sending = null;
export function sendAlarmActions(dispatch, now = Date.now) {
    if (!isNativeApp() || available === false) return Promise.resolve();
    sending ??= (async () => {
        let actions;
        try {
            actions = (await QuideyAlarms.pendingActions()).actions ?? [];
        } catch {
            return;
        }
        if (actions.length === 0) return;
        const sent = [];
        for (const { key, reminderId, action, minutes, at } of actions) {
            // a snooze counts from when it was tapped; one already over has rung here meanwhile
            const left = Math.round(((at ?? now()) + (minutes || SNOOZE_MINUTES) * 60 * 1000 - now()) / 60000);
            if (action === 'snooze' && left < 1) { sent.push(key); continue; }
            const path = action === 'snooze' ? 'snooze' : 'done';
            const body = action === 'snooze' ? JSON.stringify({ minutes: Math.min(left, 120) }) : undefined;
            try {
                await apiFetch(`/api/tester/reminders/${reminderId}/${path}`, { method: 'POST', body });
                sent.push(key);
            } catch (err) {
                // deleted meanwhile: nothing to send any more
                if (err?.status === 404) sent.push(key);
            }
        }
        if (sent.length > 0) await QuideyAlarms.clearActions({ keys: sent }).catch(() => {});
        await dispatch(fetchReminders()).catch(() => {});
    })().finally(() => { sending = null; });
    return sending;
}
