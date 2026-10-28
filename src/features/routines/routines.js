// Routines: a name, an emoji and steps (each with minutes, 0 = no timer) that the app guides me
// through one after the other ("Putzroutine": windows open, desk clear, vacuum, …). Planned on
// weekdays at a time of day: Home's dashboard lists today's, the server pushes at the time, and
// while the app is open a toast says it's time. API under /api/routines.
//
// A run in progress (routines/RoutineRunner.jsx) is kept in localStorage `routineRun` and
// counted by the wall clock, like the focus timer, so a phone that goes off loses nothing.

import { useEffect } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { apiFetch, fill } from '../helperFunction';
import { showToast } from '../toast/toast';
import { translate } from '../../i18n/useTranslation';
import { playSound } from '../settings/sound';

const SET_ROUTINES = 'SET_ROUTINES';
const ROUTINE_SAVED = 'ROUTINE_SAVED';
const ROUTINE_REMOVED = 'ROUTINE_REMOVED';

export const ROUTINE_EMOJIS = ['🧽', '☀️', '📚', '🌙', '🧘', '🏃', '🍳', '🧺', '🗓️', '✍️', '💧', '🎯', '🧠', '🎧', '🌱', '✨'];

// Ready-made routines to start from; their texts (name, steps) are in the reader's language
// (focusTexts: routineTpl_<key>_name, routineTpl_<key>_steps), the minutes per step here
export const ROUTINE_TEMPLATES = [
    { key: 'clean', emoji: '🧽', minutes: [2, 5, 10, 10, 5, 3] },
    { key: 'morning', emoji: '☀️', minutes: [2, 5, 10, 5, 3] },
    { key: 'study', emoji: '📚', minutes: [1, 2, 3, 2, 0] },
    { key: 'evening', emoji: '🌙', minutes: [5, 5, 3, 10, 0] },
    { key: 'week', emoji: '🗓️', minutes: [5, 10, 10, 5, 5] },
];

export function templateRoutine(template, language) {
    const steps = translate(language, `routineTpl_${template.key}_steps`);
    return {
        name: translate(language, `routineTpl_${template.key}_name`),
        emoji: template.emoji,
        steps: (Array.isArray(steps) ? steps : []).map((title, i) => ({ title, minutes: template.minutes[i] ?? 0 })),
        days: [],
        atTime: null,
        remind: true,
    };
}

export default function routinesReducer(state = { list: [], loaded: false }, action) {
    switch (action.type) {
        case SET_ROUTINES:
            return { list: action.payload, loaded: true };
        case ROUTINE_SAVED: {
            const exists = state.list.some(routine => routine.id === action.payload.id);
            return {
                ...state,
                list: exists ? state.list.map(routine => routine.id === action.payload.id ? action.payload : routine) : [...state.list, action.payload],
            };
        }
        case ROUTINE_REMOVED:
            return { ...state, list: state.list.filter(routine => routine.id !== action.payload) };
        default:
            return state;
    }
}

export const fetchRoutines = () => async (dispatch) => {
    const list = await apiFetch('/api/routines');
    dispatch({ type: SET_ROUTINES, payload: list });
    return list;
};

// a routine without id is new
export const saveRoutine = (routine) => async (dispatch) => {
    const body = JSON.stringify({ name: routine.name, emoji: routine.emoji || null, steps: routine.steps, days: routine.days, atTime: routine.atTime || null, remind: routine.remind });
    const saved = routine.id
        ? await apiFetch(`/api/routines/${routine.id}`, { method: 'PUT', body })
        : await apiFetch('/api/routines', { method: 'POST', body });
    dispatch({ type: ROUTINE_SAVED, payload: saved });
    return saved;
};

export const deleteRoutine = (id) => async (dispatch) => {
    await apiFetch(`/api/routines/${id}`, { method: 'DELETE' });
    dispatch({ type: ROUTINE_REMOVED, payload: id });
};

export const logRoutineRun = (id, run) => async (dispatch) => {
    const saved = await apiFetch(`/api/routines/${id}/runs`, { method: 'POST', body: JSON.stringify(run) });
    dispatch({ type: ROUTINE_SAVED, payload: saved });
    return saved;
};

// Monday = 1 … Sunday = 7, like the server
export const isoWeekday = (date = new Date()) => ((date.getDay() + 6) % 7) + 1;

export const totalMinutes = (routine) => routine.steps.reduce((sum, step) => sum + (step.minutes || 0), 0);

// planned for today, by time (those without a time last)
export const routinesForDay = (list, date = new Date()) => list
    .filter(routine => routine.days.includes(isoWeekday(date)))
    .sort((a, b) => (a.atTime ?? '99').localeCompare(b.atTime ?? '99'));

// "Mo, Mi, Fr · 18:30"; every day / weekdays in words
export function planText(routine, t) {
    if (routine.days.length === 0) return t('routineNotPlanned');
    const days = routine.days.length === 7 ? t('routineEveryDay')
        : routine.days.join() === '1,2,3,4,5' ? t('routineWeekdays')
        : routine.days.map(day => t('weekDays', day - 1)).join(', ');
    return routine.atTime ? `${days} · ${routine.atTime}` : days;
}

// ---------- the run in progress ----------
const RUN_KEY = 'routineRun';

export function readRoutineRun() {
    try {
        const run = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null');
        if (!run || typeof run.routineId !== 'number' || Date.now() - run.startedAt > 24 * 60 * 60 * 1000) return null;
        return run;
    } catch {
        return null;
    }
}
export function storeRoutineRun(run) {
    try {
        if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run));
        else localStorage.removeItem(RUN_KEY);
    } catch { /* only for this visit */ }
}

// ---------- while the app is open: "time for your routine" ----------
const CHECK_MS = 30 * 1000;
const told = new Set();

export function useRoutineReminders(allowed) {
    const dispatch = useDispatch();
    const store = useStore();
    const loaded = useSelector(state => state.routines.loaded);

    useEffect(() => {
        if (allowed && !loaded) dispatch(fetchRoutines()).catch(() => {});
    }, [allowed, loaded, dispatch]);

    useEffect(() => {
        if (!allowed) return;
        const check = () => {
            const state = store.getState();
            const now = new Date();
            const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const today = now.toDateString();
            for (const routine of routinesForDay(state.routines.list, now)) {
                if (!routine.atTime || !routine.remind || routine.doneToday) continue;
                const key = `${routine.id}@${today}`;
                // from its time on, for 15 minutes (the app may have been opened a little later)
                const [h, m] = routine.atTime.split(':').map(Number);
                const late = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m);
                if (told.has(key) || late < 0 || late > 15 || hhmm < routine.atTime) continue;
                told.add(key);
                playSound('reminder');
                const language = state.settings.language;
                dispatch(showToast(fill(translate(language, 'routineTimeFor'), { name: `${routine.emoji ?? ''} ${routine.name}`.trim() }), 'info',
                    { to: `/routines/${routine.id}/run`, detail: translate(language, 'routineTapToStart') }));
            }
        };
        check();
        const id = setInterval(check, CHECK_MS);
        return () => clearInterval(id);
    }, [allowed, store, dispatch]);
}
