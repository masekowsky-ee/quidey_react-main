import styles from '../Inbox.module.css';
import own from './Reminders.module.css';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { showToast } from '../../features/toast/toast';
import { showForms } from '../../features/settings/settingsAction';
import {
    selectReminders, sortReminders, deleteReminder, reminderDone,
    dueOccurrence, nextOccurrence, isDone, isMissed, isWeekly, weekdaysText,
} from '../../features/reminders/reminders';
import ConfirmDeleteButton from '../ConfirmDeleteButton.jsx';
import Icon from '../icons';
import { FormSheet } from '../QuickAdd.jsx';
import ReminderForm from './ReminderForm.jsx';
import { useWhenText } from './whenText';

// Postfach → Erinnerungen, on top for testers: my own reminders (due / missed first, then by
// their next time, the done ones of the last 7 days last). Above the tasks' reminders.
export default function ReminderList() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const when = useWhenText();
    const list = useSelector(selectReminders);
    const loaded = useSelector(state => state.reminders.loaded);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(null);
    // read the clock once per visit (the list re-sorts when it changes)
    const [now] = useState(() => new Date());

    const run = async (id, action) => {
        setBusy(id);
        try {
            await dispatch(action);
        } catch (err) {
            dispatch(showToast(err.message || t('friendError_generic'), 'error'));
        } finally {
            setBusy(null);
        }
    };

    const line = (reminder) => {
        if (isDone(reminder)) return fill(t('reminderDoneAt'), { when: when(reminder.doneAt) });
        if (dueOccurrence(reminder, now)) return t('reminderDueNow');
        if (isMissed(reminder, now)) return fill(t('reminderMissed'), { when: when(reminder.at) });
        const next = nextOccurrence(reminder, now);
        const snoozed = reminder.snoozedUntil && next && next.getTime() === new Date(reminder.snoozedUntil).getTime();
        const parts = [
            snoozed ? fill(t('reminderSnoozed'), { when: when(next) }) : next && fill(t('reminderNext'), { when: when(next) }),
            isWeekly(reminder) && weekdaysText(reminder, t),
        ].filter(Boolean);
        return parts.join(' · ');
    };

    return (
        <section className={own.mine} aria-labelledby="my-reminders">
            <div className={own.head}>
                <h3 id="my-reminders" className={styles.subTitle}>{t('remindersMine')}</h3>
                <button type="button" className={styles.quietBtn} onClick={() => dispatch(showForms('reminder'))}>
                    <Icon name="plus" size={16} /> {t('reminderNew')}
                </button>
            </div>
            {loaded && list.length === 0 && <p className={styles.empty}>{t('remindersEmpty')}</p>}
            {list.length > 0 &&
                <ul className={styles.list}>
                    {sortReminders(list, now).map(reminder => {
                        const done = isDone(reminder);
                        const open = !done && (dueOccurrence(reminder, now) || isMissed(reminder, now));
                        return (
                            <li key={reminder.id} className={`${styles.row} ${done ? own.done : ''}`}>
                                <span className={styles.avatar} aria-hidden="true"><Icon name="alarm" size={18} /></span>
                                <span className={styles.rowText}>
                                    <span className={styles.rowTitle}>{reminder.text}</span>
                                    <span className={`${styles.rowMeta} ${open ? own.due : ''}`}>{line(reminder)}</span>
                                </span>
                                <span className={styles.actions}>
                                    {open &&
                                        <button type="button" className={styles.primaryBtn} disabled={busy === reminder.id}
                                            onClick={() => run(reminder.id, reminderDone(reminder.id))}>{t('reminderDone')}</button>}
                                    {!done &&
                                        <button type="button" className={own.iconBtn} aria-label={`${t('reminderEdit')}: ${reminder.text}`} title={t('reminderEdit')}
                                            onClick={() => setEditing(reminder)}><Icon name="edit" size={18} /></button>}
                                    <ConfirmDeleteButton className={own.iconBtn} label={`${t('reminderDelete')}: ${reminder.text}`}
                                        onConfirm={() => run(reminder.id, deleteReminder(reminder.id))} />
                                </span>
                            </li>
                        );
                    })}
                </ul>}
            {editing &&
                <FormSheet onClose={() => setEditing(null)}>
                    {(sheet, close) => <ReminderForm reminder={editing} sheet={sheet} onDone={close} />}
                </FormSheet>}
        </section>
    );
}
