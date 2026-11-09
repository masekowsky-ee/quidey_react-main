// The statistics' session list shows sittings, not every saved round: Pomodoro rounds (or
// countdowns) with only a break between them make one row. Runs under a minute are left out
// (their time still counts in the totals).
import { SESSION_MIN_SECONDS } from '../session/sessionAction';
import { sameDay } from '../helperFunction';

const MINUTE = 60 * 1000;

// How long a pause may be inside one sitting: the longest Pomodoro break plus 5 minutes
export const sittingGapMs = (pomodoro) => (Math.max(pomodoro.short, pomodoro.long) + 5) * MINUTE;

// Time per task over several sessions, most first
function addTasks(sessions) {
    const byId = new Map();
    for (const s of sessions) {
        for (const task of s.workedTasks ?? []) {
            const had = byId.get(task.id);
            byId.set(task.id, had ? { ...had, time: (had.time ?? 0) + (task.time ?? 0) } : { ...task });
        }
    }
    return [...byId.values()].sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
}

// sessions (any order) → sittings, newest first:
// { key, date (start of the first), rounds, totalTime (s), workedTasks, group, sessions (oldest first) }
export function groupSittings(sessions, gapMs) {
    const real = sessions
        .filter(s => (s.totalTime ?? 0) >= SESSION_MIN_SECONDS)
        .map(s => ({ s, start: new Date(s.date) }))
        .sort((a, b) => a.start - b.start);

    const groups = [];
    for (const item of real) {
        const last = groups[groups.length - 1];
        const prev = last?.[last.length - 1];
        const prevEnd = prev ? prev.start.getTime() + prev.s.totalTime * 1000 : 0;
        if (prev && sameDay(prev.start, item.start) && item.start - prevEnd <= gapMs) last.push(item);
        else groups.push([item]);
    }

    return groups.reverse().map(items => {
        const list = items.map(i => i.s);
        const groupsUsed = new Set(list.map(s => s.group).filter(g => g && g !== 'all'));
        return {
            key: list.map(s => s.id).join('-'),
            date: items[0].start,
            rounds: list.length,
            totalTime: list.reduce((sum, s) => sum + s.totalTime, 0),
            workedTasks: addTasks(list),
            group: groupsUsed.size === 1 ? [...groupsUsed][0] : null,
            sessions: list,
        };
    });
}
