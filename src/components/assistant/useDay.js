// A day as the chat's cards say it: "Sa 12.12." (or "ohne Tag").
import { mondayIndex, parseDate } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';

export function useDay() {
    const { t } = useTranslation();
    return (value) => {
        const day = parseDate(value);
        return day ? `${t('weekDays', mondayIndex(day))} ${day.getDate()}.${day.getMonth() + 1}.` : t('assistantNoDay');
    };
}
