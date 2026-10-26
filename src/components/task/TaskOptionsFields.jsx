import styles from './TaskOptions.module.css';
import { useId } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { REPEATS } from '../../features/calendar/calendar';
import { askForReminderPermission, reminderLabel, REMINDERS_MAX, selectAllDayTime } from '../../features/tasks/reminders';
import { linkIsValid } from '../../features/tasks/taskFields';
import { usePushState } from '../../features/pwa/push';

// minutes before the start; a task without a time of day starts at my all-day time
const TIMED_REMINDERS = [0, 5, 10, 15, 30, 60, 120, 1440];
const ALL_DAY_REMINDERS = [0, 1440, 2880, 10080];

// The choices, plus any unusual value the task already has
const withCurrent = (list, current) => [...new Set([...list, ...current])].sort((a, b) => a - b);

// how often a repeating task comes back at most (like the server)
const REPEAT_LEFT_MAX = 1000;
// what "ends after …" starts with
const REPEAT_LEFT_DEFAULT = 10;

// The optional details of a task: reminders, repeating, location, link and extra info (a task's
// planned time and an event's length are on the wheels, see DurationWheel).
// value: { reminders, reminder_email, location, link, details, repeat, repeat_left };
// reminders: minutes before the start, any number up to REMINDERS_MAX, picked one by one;
// repeat_left: how many more times it comes back after this one (null: no end).
// onChange gets the changed fields.
// hasTime: reminders count from the start time; without one from my all-day time (Settings).
// hasDate: reminders and repeating count from the day, so without one they are off.
// canMail: "also by mail" (value.reminder_email) is offered, only to the task's owner.
// personal: false for a task in a shared session, which has no reminder and no repeating.
export default function TaskOptionsFields({ value, onChange, hasTime, hasDate = true, canMail = true, personal = true }) {
    const { t } = useTranslation();
    const id = useId();
    const allDayTime = useSelector(selectAllDayTime);
    const push = usePushState();
    const linkOk = linkIsValid(value.link);
    const reminders = value.reminders ?? [];
    const hasReminder = hasDate && reminders.length > 0;
    const choices = withCurrent(hasTime ? TIMED_REMINDERS : ALL_DAY_REMINDERS, reminders);
    const pushOff = hasReminder && !['on', 'unknown'].includes(push.status);
    const hint = !hasDate || !hasTime || pushOff;

    const toggleReminder = (minutes) => {
        const on = reminders.includes(minutes);
        if (!on) askForReminderPermission();
        onChange({ reminders: on ? reminders.filter(item => item !== minutes) : [...reminders, minutes].sort((a, b) => a - b) });
    };

    return (
        <div className={styles.options}>
            {personal &&
            <fieldset className={styles.reminders} disabled={!hasDate} aria-describedby={hint ? `${id}-reminder-hint` : undefined}>
                <legend className={styles.remindersLegend}>{t('reminders')}</legend>
                <div className={styles.reminderChoices}>
                    {choices.map(minutes => {
                        const on = hasDate && reminders.includes(minutes);
                        return (
                            <button key={minutes} type="button" aria-pressed={on}
                                disabled={!on && reminders.length >= REMINDERS_MAX} onClick={() => toggleReminder(minutes)}>
                                {reminderLabel(t, minutes, hasTime)}
                            </button>
                        );
                    })}
                </div>
            </fieldset>}
            {personal && hint &&
                <p id={`${id}-reminder-hint`} className={styles.hint}>
                    {!hasDate ? t('reminderNeedsDate')
                        : <>
                            {!hasTime && fill(t('reminderAllDayAt'), { time: allDayTime })}
                            {/* the phone only rings with notifications on for this device */}
                            {pushOff && <> {t('reminderPushOff')} <Link to="/settings#app">{t('reminderPushOffLink')}</Link></>}
                        </>}
                </p>}
            {/* mails go to the task's owner, so only they see the switch */}
            {personal && canMail && hasReminder &&
                <label className={styles.checkRow}>
                    <input type="checkbox" checked={Boolean(value.reminder_email)}
                        onChange={(e) => onChange({ reminder_email: e.target.checked })} />
                    <span>{t('reminderByEmail')}</span>
                </label>}
            {personal &&
            <label className={styles.field}>
                <span>{t('repeat')}</span>
                <select value={hasDate ? (value.repeat ?? '') : ''} disabled={!hasDate}
                    aria-describedby={hasDate ? undefined : `${id}-repeat-hint`}
                    onChange={(e) => onChange({ repeat: e.target.value || null })}>
                    <option value="">{t('repeatNone')}</option>
                    {REPEATS.map(repeat => <option key={repeat} value={repeat}>{t(`repeat_${repeat}`)}</option>)}
                </select>
            </label>}
            {personal && !hasDate && <p id={`${id}-repeat-hint`} className={styles.hint}>{t('repeatNeedsDate')}</p>}
            {/* a repeat can end: never, or after a number of times */}
            {personal && hasDate && value.repeat &&
                <fieldset className={styles.repeatEnd}>
                    <legend className={styles.repeatEndLegend}>{t('repeatEnds')}</legend>
                    <div className={styles.repeatEndChoice}>
                        <button type="button" aria-pressed={!Number.isInteger(value.repeat_left)}
                            onClick={() => onChange({ repeat_left: null })}>{t('repeatEndsNever')}</button>
                        <button type="button" aria-pressed={Number.isInteger(value.repeat_left)}
                            onClick={() => onChange({ repeat_left: Number.isInteger(value.repeat_left) ? value.repeat_left : REPEAT_LEFT_DEFAULT })}>
                            {t('repeatEndsAfter')}
                        </button>
                    </div>
                    {Number.isInteger(value.repeat_left) &&
                        <label className={styles.repeatCount}>
                            <input type="number" inputMode="numeric" min="1" max={REPEAT_LEFT_MAX} value={value.repeat_left}
                                onChange={(e) => {
                                    const n = Number.parseInt(e.target.value, 10);
                                    onChange({ repeat_left: Number.isNaN(n) ? 1 : Math.min(REPEAT_LEFT_MAX, Math.max(1, n)) });
                                }} />
                            <span>{t('repeatEndsTimes')}</span>
                        </label>}
                </fieldset>}
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
