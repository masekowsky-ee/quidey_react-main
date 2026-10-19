import styles from './TaskOptions.module.css';
import { useId } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { durationText } from '../../features/calendar/calendar';
import { askForReminderPermission } from '../../features/tasks/reminders';
import { linkIsValid } from '../../features/tasks/taskFields';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 480];
const REMINDERS = [0, 5, 10, 15, 30, 60, 120, 1440];

// The value of a select: '' for none, otherwise the number; keeps an unusual value as an option
const withCurrent = (list, current) =>
    current === null || current === undefined || list.includes(Number(current)) ? list : [...list, Number(current)].sort((a, b) => a - b);

const toNumberOrNull = (value) => (value === '' ? null : Number(value));

// The optional details of a task: duration, reminder, location, link and extra info.
// value: { duration_minutes, reminder_minutes, location, link, details }; onChange gets the changed fields.
// hasTime: reminders count from the start time, so without one they are off.
export default function TaskOptionsFields({ value, onChange, hasTime }) {
    const { t } = useTranslation();
    const id = useId();
    const linkOk = linkIsValid(value.link);

    const reminderLabel = (minutes) => minutes === 0 ? t('reminderAtStart') : fill(t('reminderBefore'), { time: durationText(minutes) });

    return (
        <div className={styles.options}>
            <div className={styles.row}>
                <label className={styles.field}>
                    <span>{t('duration')}</span>
                    <select value={value.duration_minutes ?? ''} onChange={(e) => onChange({ duration_minutes: toNumberOrNull(e.target.value) })}>
                        <option value="">{t('durationNone')}</option>
                        {withCurrent(DURATIONS, value.duration_minutes).map(minutes => (
                            <option key={minutes} value={minutes}>{durationText(minutes)}</option>
                        ))}
                    </select>
                </label>
                <label className={styles.field}>
                    <span>{t('reminder')}</span>
                    <select value={hasTime ? (value.reminder_minutes ?? '') : ''} disabled={!hasTime}
                        aria-describedby={hasTime ? undefined : `${id}-reminder-hint`}
                        onChange={(e) => {
                            if (e.target.value !== '') askForReminderPermission();
                            onChange({ reminder_minutes: toNumberOrNull(e.target.value) });
                        }}>
                        <option value="">{t('reminderNone')}</option>
                        {withCurrent(REMINDERS, value.reminder_minutes).map(minutes => (
                            <option key={minutes} value={minutes}>{reminderLabel(minutes)}</option>
                        ))}
                    </select>
                </label>
            </div>
            {!hasTime && <p id={`${id}-reminder-hint`} className={styles.hint}>{t('reminderNeedsTime')}</p>}
            <div className={styles.row}>
                <label className={styles.field}>
                    <span>{t('location')}</span>
                    <input value={value.location ?? ''} maxLength={200} placeholder={t('locationPlaceholder')}
                        onChange={(e) => onChange({ location: e.target.value })} />
                </label>
                <label className={styles.field}>
                    <span>{t('link')}</span>
                    <input type="url" inputMode="url" value={value.link ?? ''} maxLength={500} placeholder="https://"
                        aria-invalid={!linkOk} aria-describedby={linkOk ? undefined : `${id}-link-error`}
                        onChange={(e) => onChange({ link: e.target.value })} />
                </label>
            </div>
            {!linkOk && <p id={`${id}-link-error`} className={styles.error}>{t('linkInvalid')}</p>}
            <label className={styles.field}>
                <span>{t('details')}</span>
                <textarea rows={2} value={value.details ?? ''} maxLength={5000}
                    onChange={(e) => onChange({ details: e.target.value })} />
            </label>
        </div>
    );
}
