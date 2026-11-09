import { describe, it, expect, beforeEach } from 'vitest';
import { isCalm, readCalm, setCalm } from '../features/focus/calm';

const state = (session = {}) => ({
    session: {
        timerMode: 'timer',
        timer: { time: 20 * 60000, active: true },
        sessionParams: { time: 25 * 60000 },
        pomodoro: { phase: 'focus', round: 0, config: {} },
        ...session,
    },
});

describe('calm mode in the Fokusraum', () => {
    beforeEach(() => localStorage.removeItem('focusCalm'));

    it('is on by default and can be switched off', () => {
        expect(readCalm()).toBe(true);
        setCalm(false);
        expect(readCalm()).toBe(false);
        setCalm(true);
        expect(readCalm()).toBe(true);
    });

    it('only while a focus round runs in the Fokusraum', () => {
        expect(isCalm(state(), '/focus', true)).toBe(true);
        expect(isCalm(state(), '/', true)).toBe(false);
        expect(isCalm(state(), '/focus', false)).toBe(false);
        expect(isCalm(state({ timer: { time: 20 * 60000, active: false } }), '/focus', true)).toBe(false);
        expect(isCalm(state({ timerMode: 'pomodoro', pomodoro: { phase: 'short', round: 1, config: {} } }), '/focus', true)).toBe(false);
    });
});
