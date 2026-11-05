import { useTranslation } from '../../i18n/useTranslation';
import { dueText } from '../../features/helperFunction';
import { dateKey } from '../../features/calendar/calendar';

const hhmm = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

// "Heute 18:00", "Morgen 07:30", "Freitag 09:00", "12.11. 14:00": when a reminder rings
export function whenText(date, t, now = new Date()) {
    const day = dueText(dateKey(date), t, now);
    return `${day} ${hhmm(date)}`;
}

export function useWhenText() {
    const { t } = useTranslation();
    return (date) => whenText(new Date(date), t);
}
