import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import styles from './FocusSheet.module.css';
import Icon from '../icons.jsx';
import { Bone } from '../skeleton/Skeleton.jsx';
import { NoteView } from '../notes/NoteView.jsx';
import { useTranslation } from '../../i18n/useTranslation';
import { fetchNote, updateNote, toggleCheck } from '../../features/focus/notebook';
import { titleOf } from '../../features/notes/notes';
import { clearCardNote } from '../../features/home/cardNote';
import { formatClock, fill } from '../../features/helperFunction';
import { selectTimerInProgress } from '../../features/session/sessionAction';
import { showToast } from '../../features/toast/toast';

// "30:00", "1:05:00": hours only when there are any
const clockText = (ms) => formatClock(ms).replace(/^00:/, '');

// A note in Home's white card: its title in the serif and its text as it reads (headings, lists,
// checklists you can tick), "Öffnen" to write in it. No timer and no focus link here. While the
// timer of the task in focus is running, one line says so and leads back to the task.
export default function CardNote({ id }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [loaded, setLoaded] = useState({ id: null, note: null });
    const note = loaded.id === id ? loaded.note : null;
    const timer = useSelector(state => state.session.timer);
    const inProgress = useSelector(selectTimerInProgress);
    const timerOn = timer.active || inProgress;

    useEffect(() => {
        let live = true;
        fetchNote(id)
            .then(found => {
                if (!live) return;
                // gone or in the trash: the card goes back to the task
                if (!found || found.trashedAt) clearCardNote();
                else setLoaded({ id, note: found });
            })
            .catch(() => { if (live) clearCardNote(); });
        return () => { live = false; };
    }, [id]);

    const toggle = (index) => {
        const before = note.body;
        const body = toggleCheck(before, index);
        if (body === before) return;
        setLoaded({ id, note: { ...note, body } });
        updateNote(note.id, { body }).catch(() => {
            setLoaded({ id, note: { ...note, body: before } });
            dispatch(showToast(t('noteSaveFailed'), 'error'));
        });
    };

    return (
        <>
            <div className={styles.what}>
                {note
                    ? <h2 className={styles.title}>{titleOf(note) || t('homeNoteUntitled')}</h2>
                    : <Bone w="60%" h="2rem" />}
            </div>
            <div className={styles.noteText}>
                {note
                    ? <NoteView body={note.body} onToggle={toggle} />
                    : <><Bone w="90%" /><Bone w="75%" /><Bone w="82%" /></>}
            </div>
            <div className={styles.noteBar}>
                {timerOn &&
                    <button type="button" className={styles.text} onClick={clearCardNote}>
                        <Icon name="timer" size={16} />
                        {fill(t('homeCardTimerRunning'), { time: clockText(timer.time) })} · {t('homeCardBackToTask')}
                    </button>}
                <div className={styles.taskActions}>
                    {note &&
                        <Link to={`/notes?note=${note.id}`} className={styles.icon} title={t('homeCardNoteOpen')} aria-label={t('homeCardNoteOpen')}>
                            <Icon name="expand" size={18} />
                        </Link>}
                    <button type="button" className={styles.icon} onClick={clearCardNote} title={t('homeCardNoteOut')} aria-label={t('homeCardNoteOut')}>
                        <Icon name="release" size={18} />
                    </button>
                </div>
            </div>
        </>
    );
}
