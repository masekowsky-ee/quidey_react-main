import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchNotes, createNote, removeNote } from '../../features/focus/notebook';
import { showToast } from '../../features/toast/toast';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import NoteEditor from '../notes/NoteEditor.jsx';
import Notebook from './Notebook.jsx';
import ScanSheet from '../scan/ScanSheet.jsx';
import { useAiQuota } from '../../features/ai/ai';
import Icon from '../icons.jsx';
import { Bone } from '../skeleton/Skeleton.jsx';
import styles from './FocusRoom.module.css';

// Which note belongs to the session: { id, goal, day } on this device. The same goal on the
// same day writes on in the same note; a new goal (or a new day) gets a new one.
const STORE_KEY = 'focusSessionNote';
const today = () => new Date().toDateString();
function readSessionNote() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null'); } catch { return null; }
}
function storeSessionNote(value) {
    try {
        if (value) localStorage.setItem(STORE_KEY, JSON.stringify(value));
        else localStorage.removeItem(STORE_KEY);
    } catch { /* only for this visit */ }
}

// Step three of the Fokusraum: the session's note, waiting to be written. Nothing is made until
// you start writing (no empty notes); then the note takes the goal as its title and belongs to
// the task in focus. "Alle Notizen" shows the whole notebook instead.
export default function SessionNotes({ goal, focusTask }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const [notes, setNotes] = useState(null);
    const [showAll, setShowAll] = useState(false);
    const [stored, setStored] = useState(readSessionNote);
    const [creating, setCreating] = useState(false);
    const aiQuota = useAiQuota();
    const [scanning, setScanning] = useState(false);
    // a note made from the click: the cursor goes straight into it
    const [justMade, setJustMade] = useState(null);

    useEffect(() => {
        fetchNotes().then(setNotes).catch(() => setNotes([]));
    }, []);

    const wanted = goal.trim();
    const note = stored && stored.day === today() && stored.goal === wanted
        ? notes?.find(item => item.id === stored.id && !item.trashed && !item.archived)
        : null;

    const onChange = useCallback((saved) => {
        setNotes(prev => prev?.map(item => item.id === saved.id ? saved : item) ?? prev);
    }, []);

    const start = async () => {
        if (creating) return;
        setCreating(true);
        const date = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date());
        try {
            const made = await createNote({
                title: wanted || fill(t('noteNewTitle'), { date }),
                body: '',
                taskId: focusTask && !focusTask.shared ? focusTask.id : null,
            });
            const next = { id: made.id, goal: wanted, day: today() };
            storeSessionNote(next);
            setJustMade(made.id);
            setNotes(prev => [made, ...(prev ?? [])]);
            setStored(next);
        } catch (err) {
            dispatch(showToast(err.code === 'NOTEBOOK_LIMIT' ? t('noteLimit') : err.code === 'NOTEBOOK_STORAGE_FULL' ? t('noteStorageFull') : t('noteSaveFailed'), 'error'));
        } finally {
            setCreating(false);
        }
    };

    const forget = () => { storeSessionNote(null); setStored(null); };
    const deleteNote = async (id) => {
        await removeNote(id).catch(() => {});
        setNotes(prev => prev.filter(item => item.id !== id));
        forget();
    };

    return (
        <aside className={styles.notesCol} aria-labelledby="session-notes-title" data-tip="focus-notes">
            <div className={styles.notesHead}>
                <h2 id="session-notes-title" className={styles.cardLabel}><Icon name="note" size={16} /> {t('sessionNotesTitle')}</h2>
                <div className={styles.notesHeadActions}>
                    {/* study material read by the AI (the whole notebook has its own button) */}
                    {!showAll && aiQuota?.available &&
                        <button type="button" className={styles.textBtn} onClick={() => setScanning(true)}>{t('scanTitle')}</button>}
                    <button type="button" className={styles.textBtn} onClick={() => setShowAll(all => !all)} aria-pressed={showAll}>
                        {showAll ? t('sessionNotesBack') : t('sessionNotesAll')}
                    </button>
                </div>
            </div>
            {scanning && <ScanSheet onClose={() => setScanning(false)}
                onDone={(made) => { if (made.notes) fetchNotes().then(setNotes).catch(() => {}); }} />}
            {showAll
                ? <Notebook focusTask={focusTask} />
                : notes === null
                    ? <Bone h="12rem" />
                    : note
                        ? <NoteEditor key={note.id} note={note} focusTask={focusTask} onChange={onChange} autoFocus={justMade === note.id}
                            onDelete={() => deleteNote(note.id)} onClose={() => setShowAll(true)} />
                        : <div className={styles.waiting}>
                            {wanted && <p className={styles.waitingTitle}>{wanted}</p>}
                            <p className={styles.toolHint}>{t('sessionNotesHint')}</p>
                            <button type="button" className={styles.waitingBtn} onClick={start} disabled={creating}>
                                <Icon name="edit" size={16} /> {t('sessionNotesWrite')}
                            </button>
                        </div>}
        </aside>
    );
}
