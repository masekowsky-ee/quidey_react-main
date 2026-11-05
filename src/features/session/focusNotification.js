// A lasting notification while a focus session is on (started, or paused mid-way), gone when it
// is stopped or over. Mounted once in App (useFocusNotification).
//
// Android app: the app's plugin "QuideyFocusNotification" (android/…/FocusNotificationPlugin.java)
// posts an ongoing, silent notification with Android's own chronometer, so the time runs on in it
// while the app is frozen: counting down to the end of a countdown / Pomodoro phase (and gone by
// itself at that moment), up from the start for a stopwatch; paused it shows the time standing.
// Browser / installed web app: a notification can't count by itself, so it says when the session
// ends ("endet um 14:30") or since when it runs, and is written anew on start, pause and the next
// phase. Only where notifications are already allowed (Settings → App → Benachrichtigungen):
// nothing is asked for here.
//
// Changes only when what it shows changes (not on every tick): `focusNotice` below is the same
// for every tick of a running timer, since runningSince and the time move together.

import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from '../native/native';
import { translate } from '../../i18n/useTranslation';
import { fill } from '../helperFunction';
import { selectFocusTask, selectTimerInProgress, PHASE_LABEL } from './sessionAction';

const QuideyFocusNotification = registerPlugin('QuideyFocusNotification');
const TAG = 'quidey-focus';

export const clockText = (ms) => {
    const total = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

// What the notification says now, or null for none:
// { title, text, running, countDown, base (epoch ms: the end for a countdown, the start for a stopwatch), time }
export function focusNotice(state, language) {
    if (!selectTimerInProgress(state)) return null;
    const { timer, timerMode, pomodoro, runningSince } = state.session;
    const t = (key) => translate(language, key);
    const task = selectFocusTask(state);
    const stopwatch = timerMode === 'stopwatch';
    const label = timerMode === 'pomodoro' ? t(PHASE_LABEL[pomodoro.phase]) : t('focusNoticeFocus');
    const running = timer.active && runningSince != null;
    const base = running ? (stopwatch ? runningSince - timer.time : runningSince + timer.time) : null;
    return {
        title: running ? label : fill(t('focusNoticePaused'), { label }),
        text: task?.name ?? t('focusNoticeNoTask'),
        running,
        countDown: !stopwatch,
        base,
        // standing still: the time as it stands
        time: running ? null : clockText(timer.time),
    };
}

const sameNotice = (a, b) => a === b || (a && b && a.title === b.title && a.text === b.text && a.running === b.running
    && a.countDown === b.countDown && a.time === b.time && Math.abs((a.base ?? 0) - (b.base ?? 0)) < 1500);

// ---------- the browser ----------
async function webRegistration() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker || typeof Notification === 'undefined') return null;
    if (Notification.permission !== 'granted') return null;
    return navigator.serviceWorker.getRegistration().catch(() => null);
}

const timeOfDay = (ms, language) => new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

async function showWeb(notice, language) {
    const registration = await webRegistration();
    if (!registration) return;
    const line = notice.running
        ? fill(translate(language, notice.countDown ? 'focusNoticeEndsAt' : 'focusNoticeSince'), { time: timeOfDay(notice.base, language) })
        : fill(translate(language, 'focusNoticeStandsAt'), { time: notice.time });
    await registration.showNotification(notice.title, {
        tag: TAG,
        body: `${notice.text}\n${line}`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        silent: true,
        renotify: false,
        requireInteraction: true,
        data: { url: '/focus' },
    }).catch(() => {});
}

async function hideWeb() {
    const registration = await webRegistration();
    const shown = await registration?.getNotifications?.({ tag: TAG }).catch(() => []) ?? [];
    shown.forEach(notification => notification.close());
}

// ---------- either ----------
function show(notice, language) {
    if (isNativeApp()) {
        QuideyFocusNotification.show({
            title: notice.title, text: notice.text, running: notice.running, countDown: notice.countDown,
            base: notice.base ?? 0, time: notice.time ?? '',
        }).catch(() => {});
        return;
    }
    showWeb(notice, language);
}

function hide() {
    if (isNativeApp()) { QuideyFocusNotification.hide().catch(() => {}); return; }
    hideWeb();
}

export function useFocusNotification(enabled) {
    const store = useStore();
    useEffect(() => {
        if (!enabled) return undefined;
        let last = null;
        const update = () => {
            const state = store.getState();
            const notice = focusNotice(state, state.settings.language);
            if (sameNotice(notice, last)) return;
            last = notice;
            if (notice) show(notice, state.settings.language); else hide();
        };
        update();
        const unsubscribe = store.subscribe(update);
        return () => { unsubscribe(); if (last) hide(); };
    }, [enabled, store]);
}
