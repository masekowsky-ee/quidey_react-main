// A task's planned time (duration_minutes) against the focus time I really spent on it.
import { createSelector } from '@reduxjs/toolkit';

// Seconds of focus per task id, from my saved solo sessions and the one running now:
// { [taskId]: seconds }
export const selectFocusByTask = createSelector(
    [state => state.session?.workedSessionData, state => state.session?.currentSessionData?.workedTasks],
    (sessions, current) => {
        const seconds = {};
        const add = (task) => {
            if (task?.id === undefined || task.shared) return;
            seconds[task.id] = (seconds[task.id] ?? 0) + (Number(task.time) || 0);
        };
        for (const session of sessions ?? []) for (const task of session.workedTasks ?? []) add(task);
        for (const task of current ?? []) add(task);
        return seconds;
    }
);

// How far a task is: { planned, spent (minutes), share 0..1+ }, or null without a planned time
export function plannedProgress(task, focusByTask) {
    const planned = Number(task?.duration_minutes) || 0;
    if (task?.kind === 'event' || planned <= 0) return null;
    const spent = Math.round((focusByTask?.[task.id] ?? 0) / 60);
    return { planned, spent, share: spent / planned };
}
