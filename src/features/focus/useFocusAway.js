// Leaving Quidey during a focus round (mounted once in App, useFocusAway). Only where it can be
// told whether the device was in use meanwhile (away.js):
// - Android app: the app's plugin "QuideyAway" (AwayPlugin.java in quidey_android) counts the
//   time away with the screen on and unlocked, and nudges once after NUDGE_AFTER_MS of it while a
//   focus round runs (a notification, never with the screen off); back in the app it says how long.
// - A computer's browser (a fine pointer): while the tab is hidden a worker beats twice a second;
//   beats stop while the computer sleeps, so only awake time counts. After NUDGE_AFTER_MS of it a
//   notification (only where notifications are already allowed).
// - A phone's browser and the installed web app can't tell a screen turned off from another app:
//   nothing is counted, nudged or marked there (awayPlatform() is null).
// Back after at least AWAY_MIN_MS away during a running round: a toast "Willkommen zurück" with the
// time, and the day's tally / the round's count go up (Dein Tag, the Pomodoro recap).

import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from '../native/native';
import { translate } from '../../i18n/useTranslation';
import { fill } from '../helperFunction';
import { showToast } from '../toast/toast';
import { selectFocusTask } from '../session/sessionAction';
import { awakeBeat, inFocusRound, noteReturn, readTally, roundChange, startRound, endRound, today, writeTally, NUDGE_AFTER_MS } from './away';

const QuideyAway = registerPlugin('QuideyAway');
const NUDGE_TAG = 'quidey-away';

// 'native' | 'desktop' | null: where time away can be told from a screen turned off
export function awayPlatform() {
    if (isNativeApp()) return 'native';
    if (typeof window === 'undefined' || !window.matchMedia) return null;
    return window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(pointer: coarse)').matches ? 'desktop' : null;
}

// the round runs right now (not paused)
const running = (state) => inFocusRound(state) && state.session.timer.active;

export const minutesText = (ms) => Math.max(1, Math.round(ms / 60000));

// what the nudge says: { title, text } (title with {min} left for the app to fill in)
function nudgeTexts(state) {
    const language = state.settings.language;
    const t = (key) => translate(language, key);
    const task = selectFocusTask(state);
    const countdown = state.session.timerMode !== 'stopwatch';
    return {
        title: countdown ? t('awayNudgeTitle') : t('awayNudgeOpen'),
        text: task?.name ?? t('awayNudgeText'),
        countdown,
    };
}

const leftMs = (state) => {
    const { timer, runningSince } = state.session;
    return Math.max(0, timer.time - (runningSince != null ? Date.now() - runningSince : 0));
};

// ---------- the browser on a computer ----------
async function workerRegistration() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker || typeof Notification === 'undefined') return null;
    if (Notification.permission !== 'granted') return null;
    return navigator.serviceWorker.getRegistration().catch(() => null);
}

async function showNudge(state) {
    const registration = await workerRegistration();
    if (!registration) return;
    const { title, text, countdown } = nudgeTexts(state);
    await registration.showNotification(countdown ? fill(title, { min: minutesText(leftMs(state)) }) : title, {
        tag: NUDGE_TAG, body: text, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: '/focus' },
    }).catch(() => {});
}

async function hideNudge() {
    const registration = await workerRegistration();
    const shown = await registration?.getNotifications?.({ tag: NUDGE_TAG }).catch(() => []) ?? [];
    shown.forEach(notification => notification.close());
}

// a beat twice a second while hidden: a worker where there is one (a background tab slows the
// page's own timers), else the page's timer
function startBeat(onBeat) {
    if (typeof Worker !== 'undefined') {
        try {
            const worker = new Worker(new URL('../session/titleTick.worker.js', import.meta.url));
            worker.onmessage = onBeat;
            return () => worker.terminate();
        } catch { /* no worker: the page's timer below */ }
    }
    const id = setInterval(onBeat, 500);
    return () => clearInterval(id);
}

function desktopSource(store, onBack) {
    let away = null;
    const leave = () => {
        const state = store.getState();
        away = { running: running(state), awakeMs: 0, last: Date.now(), nudged: false, stop: null };
        away.stop = startBeat(() => {
            const now = Date.now();
            away.awakeMs = awakeBeat(away.awakeMs, now - away.last);
            away.last = now;
            if (away.running && !away.nudged && away.awakeMs >= NUDGE_AFTER_MS && running(store.getState())) {
                away.nudged = true;
                showNudge(store.getState());
            }
        });
    };
    const back = () => {
        if (!away) return;
        away.stop?.();
        // the time since the last beat, if it was in time
        const awakeMs = awakeBeat(away.awakeMs, Date.now() - away.last);
        const wasRunning = away.running;
        const nudged = away.nudged;
        away = null;
        if (nudged) hideNudge();
        onBack({ awakeMs, running: wasRunning });
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? leave() : back());
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        away?.stop?.();
    };
}

// ---------- the Android app ----------
function nativeSource(store, onBack) {
    let armed = null;
    const arm = () => {
        const state = store.getState();
        const next = running(state) ? { ...nudgeTexts(state), endsAt: state.session.timerMode !== 'stopwatch' ? Date.now() + leftMs(state) : 0 } : null;
        const key = next ? `${next.title}|${next.text}|${Math.round(next.endsAt / 5000)}` : null;
        if (key === armed) return;
        armed = key;
        (next ? QuideyAway.arm({ ...next, afterMs: NUDGE_AFTER_MS }) : QuideyAway.disarm()).catch(() => {});
    };
    arm();
    const unsubscribe = store.subscribe(arm);
    const listening = QuideyAway.addListener('away', ({ awakeMs, focusing }) => onBack({ awakeMs: Number(awakeMs) || 0, running: !!focusing }));
    return () => {
        unsubscribe();
        Promise.resolve(listening).then(handle => handle?.remove?.()).catch(() => {});
        QuideyAway.disarm().catch(() => {});
    };
}

export function useFocusAway(enabled, platform = awayPlatform()) {
    const store = useStore();
    useEffect(() => {
        if (!enabled || !platform) return undefined;

        // rounds: the count starts at nought with each focus round, the last one stays for the recap
        let before = store.getState();
        const unsubscribeRounds = store.subscribe(() => {
            const after = store.getState();
            const change = roundChange(before, after);
            before = after;
            if (change) writeTally(change === 'start' ? startRound(readTally()) : endRound(readTally()));
        });

        const onBack = (back) => {
            const { tally, counted } = noteReturn(readTally(), back, today());
            writeTally(tally);
            if (!counted) return;
            const language = store.getState().settings.language;
            const seconds = Math.round(back.awakeMs / 1000);
            store.dispatch(showToast(seconds < 60
                ? fill(translate(language, 'awayBackSeconds'), { s: seconds })
                : fill(translate(language, 'awayBack'), { min: minutesText(back.awakeMs) })));
        };

        const stopSource = platform === 'native' ? nativeSource(store, onBack) : desktopSource(store, onBack);
        return () => { unsubscribeRounds(); stopSource(); };
    }, [enabled, platform, store]);
}
