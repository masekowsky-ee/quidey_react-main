import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fetchNotes } from '../../features/focus/notebook';
import { notePreview, titleOf } from '../../features/notes/notes';
import { selectReminders, sortReminders, isDone, nextOccurrence, dueOccurrence, isMissed } from '../../features/reminders/reminders';
import { isEvent } from '../../features/tasks/kinds';
import { dateKey, taskTimeText } from '../../features/calendar/calendar';
import { dueText } from '../../features/helperFunction';
import { useWhenText } from '../reminders/whenText';
import Icon from '../icons.jsx';
import { pinCardNote } from '../../features/home/cardNote';
import styles from './HomeExtras.module.css';

// how many of each kind Home's list shows
const SHOWN = 6;

// Events, reminders and notes in Home's list, under the tasks, as far as the list head's labels
// have them switched on. Events and reminders are the app's own data; the notes are read when
// the notes are asked for.
// onDragNote(event, { id, noteId, name }): grabbed by its handle, a note can be dropped on the card
export default function HomeExtras({ kinds, onDragNote }) {
    const { t } = useTranslation();
    const when = useWhenText();
    const tasks = useSelector(state => state.task.tasks);
    const reminders = useSelector(selectReminders);
    const [notes, setNotes] = useState(null);
    const wantNotes = kinds.includes('notes');
    useEffect(() => {
        if (!wantNotes) return;
        let live = true;
        fetchNotes().then(list => { if (live) setNotes(list); }).catch(() => { if (live) setNotes([]); });
        return () => { live = false; };
    }, [wantNotes]);

    const now = new Date();
    const todayKey = dateKey(now);
    const events = tasks
        .filter(task => isEvent(task) && !task.done && task.due && dateKey(task.due) >= todayKey)
        .sort((a, b) => dateKey(a.due).localeCompare(dateKey(b.due)) || (a.due_time ?? '').localeCompare(b.due_time ?? ''))
        .slice(0, SHOWN);
    const openReminders = sortReminders(reminders.filter(r => !isDone(r)), now).slice(0, SHOWN);
    const shownNotes = (notes ?? []).filter(note => !note.archived && !note.trashedAt)
        .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, SHOWN);

    const reminderLine = (reminder) => {
        if (dueOccurrence(reminder, now)) return t('reminderDueNow');
        const next = nextOccurrence(reminder, now);
        return next ? when(next) : isMissed(reminder, now) ? when(reminder.at) : '';
    };

    const sections = [
        kinds.includes('events') && events.length > 0 && (
            <section key="events" aria-label={t('homeKind_events')}>
                <h3 className={styles.title}>{t('homeKind_events')}</h3>
                <ul className={styles.list}>
                    {events.map(event => (
                        <li key={event.id}>
                            <Link className={styles.row} to={`/calendar?view=agenda&date=${dateKey(event.due)}`}>
                                <Icon name="calendar" size={18} className={styles.icon} />
                                <span className={styles.text}>
                                    <span className={styles.name}>{event.name}</span>
                                    <span className={styles.meta}>{[dueText(dateKey(event.due), t, now), taskTimeText(event)].filter(Boolean).join(' · ')}</span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>),
        kinds.includes('reminders') && openReminders.length > 0 && (
            <section key="reminders" aria-label={t('homeKind_reminders')}>
                <h3 className={styles.title}>{t('homeKind_reminders')}</h3>
                <ul className={styles.list}>
                    {openReminders.map(reminder => (
                        <li key={reminder.id}>
                            <Link className={styles.row} to="/inbox">
                                <Icon name="alarm" size={18} className={styles.icon} />
                                <span className={styles.text}>
                                    <span className={styles.name}>{reminder.text}</span>
                                    <span className={styles.meta}>{reminderLine(reminder)}</span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>),
        wantNotes && shownNotes.length > 0 && (
            <section key="notes" aria-label={t('homeKind_notes')}>
                <h3 className={styles.title}>{t('homeKind_notes')}</h3>
                <ul className={styles.list}>
                    {shownNotes.map(note => {
                        const preview = notePreview(note, 90);
                        return (
                            <li key={note.id} className={styles.withActions}>
                                <Link className={styles.row} to={`/notes?note=${note.id}`}>
                                    <Icon name="note" size={18} className={styles.icon} />
                                    <span className={styles.text}>
                                        <span className={styles.name}>{titleOf(note) || t('homeNoteUntitled')}</span>
                                        {preview.text && <span className={styles.meta}>{preview.text}</span>}
                                    </span>
                                </Link>
                                <button type="button" className={styles.action} onClick={() => pinCardNote(note.id)}
                                    title={t('homeCardNoteShow')} aria-label={`${t('homeCardNoteShow')}: ${titleOf(note) || t('homeNoteUntitled')}`}>
                                    <Icon name="pin" size={18} />
                                </button>
                                {onDragNote &&
                                    <span className={styles.grip} style={{ touchAction: 'none' }} aria-hidden="true" title={t('homeCardNoteDrag')}
                                        onPointerDown={(e) => onDragNote(e, { id: `note-${note.id}`, noteId: note.id, name: titleOf(note) || t('homeNoteUntitled') })}>
                                        <Icon name="drag" size={18} />
                                    </span>}
                            </li>
                        );
                    })}
                </ul>
            </section>),
    ].filter(Boolean);

    // nothing asked for beyond the tasks: they have their own list
    if (!kinds.some(kind => kind !== 'tasks')) return null;
    if (sections.length === 0) {
        return kinds.includes('tasks') ? null : <p className={styles.empty}>{t('homeKindsEmpty')}</p>;
    }
    return <div className={styles.extras} data-part="home-extras">{sections}</div>;
}
