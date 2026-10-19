import { displayName, fill, formatClock } from '../helperFunction';
import { timeOf } from './togetherAction';

// One feed entry as a sentence, e.g. "Ben added "Slides""
export function describeEvent(t, event) {
    const key = event.type === 'task_assigned' && !event.target ? 'event_task_unassigned' : `event_${event.type}`;
    return fill(t(key), {
        user: displayName(event.user),
        target: displayName(event.target),
        task: event.taskName ?? '',
        text: event.text ?? '',
    });
}

// The table behind the CSV export: one row per person and task, plus each person's total
export function summaryRows(t, session) {
    const rows = [[t('csvPerson'), t('csvUsername'), t('csvTask'), t('csvTime'), t('csvMinutes')]];
    for (const person of session.people) {
        const perTask = session.tasks
            .map(task => ({ task, ms: timeOf(task, person.user.id) }))
            .filter(entry => entry.ms > 0);
        if (perTask.length === 0) continue;
        for (const { task, ms } of perTask) {
            rows.push([displayName(person.user), person.user.username, task.name, formatClock(ms), Math.round(ms / 60000)]);
        }
        rows.push([displayName(person.user), person.user.username, t('csvTotal'), formatClock(person.totalMs), Math.round(person.totalMs / 60000)]);
    }
    return rows;
}
