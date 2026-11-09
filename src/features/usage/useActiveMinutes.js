import { useEffect } from 'react';
import { track } from './usage';

const AWAY_MS = 30 * 60 * 1000;
const INPUTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];

// One active_minute for every wall-clock minute in which the page was visible and saw input
export function useActiveMinutes(enabled) {
    useEffect(() => {
        if (!enabled) return;
        let last = -1;
        const onInput = () => {
            if (document.visibilityState === 'hidden') return;
            const minute = Math.floor(Date.now() / 60000);
            if (minute === last) return;
            last = minute;
            track('active_minute', 1);
        };
        const options = { passive: true, capture: true };
        INPUTS.forEach(name => window.addEventListener(name, onInput, options));
        return () => INPUTS.forEach(name => window.removeEventListener(name, onInput, options));
    }, [enabled]);
}

// app_open: when counting starts, and when the page comes back after 30 minutes or more hidden
export function useAppOpen(enabled) {
    useEffect(() => {
        if (!enabled) return;
        track('app_open');
        let hiddenAt = null;
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                hiddenAt = Date.now();
            } else if (hiddenAt !== null) {
                if (Date.now() - hiddenAt >= AWAY_MS) track('app_open');
                hiddenAt = null;
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [enabled]);
}
