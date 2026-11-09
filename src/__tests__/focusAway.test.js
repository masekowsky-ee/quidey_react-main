import { describe, it, expect } from 'vitest';
import { inFocusRound, awakeBeat, noteReturn, roundChange, emptyTally, AWAY_MIN_MS } from '../features/focus/away';

const session = (over = {}) => ({
    timerMode: 'timer',
    timer: { time: 20 * 60000, active: true },
    sessionParams: { time: 25 * 60000 },
    pomodoro: { phase: 'focus', round: 0, config: { focus: 25, short: 5, long: 15, every: 4 } },
    ...over,
});
const state = (over) => ({ session: session(over) });

describe('when time away counts', () => {
    it('a running countdown or stopwatch is a focus round, a Pomodoro break is not', () => {
        expect(inFocusRound(state())).toBe(true);
        expect(inFocusRound(state({ timerMode: 'stopwatch', timer: { time: 5000, active: true } }))).toBe(true);
        expect(inFocusRound(state({ timerMode: 'pomodoro', pomodoro: { phase: 'short', round: 1, config: {} } }))).toBe(false);
    });

    it('a paused round is still a round, but nothing that was never started', () => {
        expect(inFocusRound(state({ timer: { time: 20 * 60000, active: false } }))).toBe(true);
        expect(inFocusRound(state({ timer: { time: 25 * 60000, active: false } }))).toBe(false);
    });
});

describe('awake time while away (the background beat)', () => {
    it('counts the beats that come in time', () => {
        expect(awakeBeat(0, 500)).toBe(500);
        expect(awakeBeat(10000, 1000)).toBe(11000);
    });

    it('leaves out a gap where the computer slept (no beats came)', () => {
        expect(awakeBeat(4000, 3 * 60000)).toBe(4000);
    });
});

describe('coming back', () => {
    const day = 'Mon Nov 09 2026';

    it('counts a distraction only when the round was running and the device was in use long enough', () => {
        const away = noteReturn(emptyTally(day), { awakeMs: 2 * 60000, running: true }, day);
        expect(away.counted).toBe(true);
        expect(away.tally).toMatchObject({ day, count: 1, ms: 2 * 60000, round: { count: 1, ms: 2 * 60000 } });
    });

    it('a short look elsewhere, a paused timer or a turned-off screen (no awake time) count nothing', () => {
        for (const back of [{ awakeMs: AWAY_MIN_MS - 1, running: true }, { awakeMs: 5 * 60000, running: false }, { awakeMs: 0, running: true }]) {
            const away = noteReturn(emptyTally(day), back, day);
            expect(away.counted).toBe(false);
            expect(away.tally.count).toBe(0);
        }
    });

    it('starts the day anew on another day', () => {
        const yesterday = { ...emptyTally('Sun Nov 08 2026'), count: 4, ms: 600000 };
        const away = noteReturn(yesterday, { awakeMs: 30000, running: true }, day);
        expect(away.tally).toMatchObject({ day, count: 1, ms: 30000 });
    });
});

describe('rounds', () => {
    it('a round starts when focus starts and ends when it stops or the break comes', () => {
        const idle = state({ timer: { time: 25 * 60000, active: false } });
        const running = state();
        const pomodoroBreak = state({ timerMode: 'pomodoro', pomodoro: { phase: 'short', round: 1, config: {} } });
        expect(roundChange(idle, running)).toBe('start');
        expect(roundChange(running, pomodoroBreak)).toBe('end');
        expect(roundChange(running, running)).toBe(null);
    });
});
