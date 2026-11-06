import { fill, parseDate, toDateOnly } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';

export const KINDS = ['exam', 'assignment', 'presentation', 'other'];

// Whole days from today to a due day (YYYY-MM-DD)
export function daysUntil(due, now = new Date()) {
    const day = parseDate(due);
    if (!day) return null;
    return Math.round((toDateOnly(day) - toDateOnly(now)) / 86400000);
}

// "heute" / "morgen" / "in 12 Tagen" / "vor 2 Tagen"
export function countdownText(due, t, now = new Date()) {
    const days = daysUntil(due, now);
    if (days == null) return '';
    if (days === 0) return t('studyDueToday');
    if (days === 1) return t('studyDueTomorrow');
    return fill(t(days > 0 ? 'studyDueIn' : 'studyDuePast'), { n: Math.abs(days) });
}

// A server error as a sentence: its code's text, else the general one
export function useStudyError() {
    const { t } = useTranslation();
    return (err) => {
        const key = `studyError_${err?.code}`;
        const text = t(key);
        return text && text !== key ? text : t('studyError_default');
    };
}
