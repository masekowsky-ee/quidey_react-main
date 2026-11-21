import { useTranslation } from '../../i18n/useTranslation';
import { dueText } from '../../features/helperFunction';
import { dateKey, hhmm } from '../../features/calendar/calendar';


// "Heute 18:00", "Morgen 07:30", "Freitag 09:00", "12.11. 14:00": when a reminder rings
export function whenText(date, t, now = new Date()) {
    const day = dueText(dateKey(date), t, now);
    return `${day} ${hhmm(date)}`;
}

export function useWhenText() {
    const { t } = useTranslation();
    return (date) => whenText(new Date(date), t);
}
