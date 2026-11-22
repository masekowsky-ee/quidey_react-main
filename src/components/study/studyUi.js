import { fill, parseDate, toDateOnly, toInputDate } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';

export const KINDS = ['exam', 'assignment', 'presentation', 'other'];

function daysUntil(due, now = new Date()) {
    const day = parseDate(due);
    if (!day) return null;
    return Math.round((toDateOnly(day) - toDateOnly(now)) / 86400000);
}

export function countdownText(due, t, now = new Date()) {
    const days = daysUntil(due, now);
    if (days == null) return '';
    if (days === 0) return t('studyDueToday');
    if (days === 1) return t('studyDueTomorrow');
    return fill(t(days > 0 ? 'studyDueIn' : 'studyDuePast'), { n: Math.abs(days) });
}

// A goal whose day is over has ended: the planner leaves it alone (ruling 29)
export const isPastGoal = (goal, now = new Date()) => Boolean(goal?.due) && goal.due < toInputDate(now);

// The text-key of a goal's state badge: done / archived, else "Vorbei" once its day is over, else null
export function goalStateKey(goal, now = new Date()) {
    if (goal.status && goal.status !== 'active') return `studyStatus_${goal.status}`;
    return isPastGoal(goal, now) ? 'studyGoalPast' : null;
}

// Whether a saved goal change moves the plan (date, time, mode): then the preview opens (ruling 30)
export const changesPlan = (change) => Boolean(change) && ['due', 'dueTime', 'planMode', 'studyFrom', 'studyTo'].some(key => key in change);

// the text of a route error: the studyError_<code> text, else the error's own message
export function useStudyMessage() {
    const { t } = useTranslation();
    return (err) => {
        const key = `studyError_${err?.code}`;
        const text = t(key);
        return text && text !== key ? text : err?.message;
    };
}

export function useStudyError() {
    const { t } = useTranslation();
    return (err) => {
        const key = `studyError_${err?.code}`;
        const text = t(key);
        return text && text !== key ? text : t('studyError_default');
    };
}
