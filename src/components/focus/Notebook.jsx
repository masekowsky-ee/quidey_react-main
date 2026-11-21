import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { checklistCount } from '../../features/focus/notebook';
import { duplicateOf, titleOf } from '../../features/notes/notes';
import { useNotes, useNoteFolders, useShortDate } from '../../features/notes/useNotes';
import { showToast } from '../../features/toast/toast';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import NoteEditor from '../notes/NoteEditor.jsx';
import ScanSheet from '../scan/ScanSheet.jsx';
import { useAiQuota } from '../../features/ai/ai';
import NotePreview from '../notes/NotePreview.jsx';
import Icon from '../icons.jsx';
import { Bone } from '../skeleton/Skeleton.jsx';
import styles from './Notebook.module.css';

// The Fokusraum's notebook: the list (pinned first, searchable, "about this task") and the open note.
// Testers get the notes area's editor here too (folders, tags, archive, trash: see /notes);
// archived notes stay out of this list then.
export default function Notebook({ focusTask }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { notes, merge: onChange, create, trash, remove, onScanDone } = useNotes();
    const aiQuota = useAiQuota();
    const [scanning, setScanning] = useState(false);
    const [folders] = useNoteFolders();
    const [openId, setOpenId] = useState(null);
    const [query, setQuery] = useState('');
    const [onlyTask, setOnlyTask] = useState(false);
    const dateFmt = useShortDate();

    const newNote = async (extra = {}) => {
        const note = await create({ title: '', body: extra.body ?? '', taskId: extra.taskId ?? null, ...(extra.title ? { title: extra.title } : {}), ...(extra.copy ?? {}) });
        if (note) setOpenId(note.id);
    };
    // an empty note isn't allowed by the server: a new one is called after its day, to write over
    const startNote = () => newNote({
        title: '',
        taskId: onlyTask && focusTask ? focusTask.id : null,
    });

    const deleteNote = async (id) => {
        if (!await remove(id)) return;
        setOpenId(null);
    };
    const trashNote = async (id) => {
        if (!await trash(id)) return;
        setOpenId(null);
        dispatch(showToast(t('noteTrashed'), 'info'));
    };

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (notes ?? [])
            .filter(note => !note.archived)
            .filter(note => !onlyTask || (focusTask && note.taskId === focusTask.id))
            .filter(note => !q || note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q))
            .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt));
    }, [notes, query, onlyTask, focusTask]);

    const open = notes?.find(note => note.id === openId);
    if (open) return <NoteEditor key={open.id} note={open} focusTask={focusTask} onChange={onChange} onDelete={() => deleteNote(open.id)} onClose={() => setOpenId(null)}
        full folders={folders} onTrash={() => trashNote(open.id)} onDuplicate={(note) => newNote({ copy: duplicateOf(note, t('noteCopyWord')) })} />;

    return (
        <div className={styles.list}>
            <div className={styles.listHead}>
                <div className={styles.search}>
                    <Icon name="search" size={16} />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('noteSearch')} aria-label={t('noteSearch')} />
                </div>
                <button type="button" className={styles.smallPrimary} onClick={startNote}><Icon name="plus" size={16} /> {t('noteNew')}</button>
                {aiQuota?.available &&
                    <button type="button" className={styles.smallGhost} onClick={() => setScanning(true)}><Icon name="brain" size={16} /> {t('scanTitle')}</button>}
            </div>
            {focusTask &&
                <label className={styles.filter}>
                    <input type="checkbox" checked={onlyTask} onChange={e => setOnlyTask(e.target.checked)} />
                    {fill(t('noteOnlyTask'), { name: focusTask.name })}
                </label>}
            {notes === null
                ? <div className={styles.rows}>{[0, 1, 2].map(i => <Bone key={i} h="3.5rem" />)}</div>
                : shown.length === 0
                    ? <div className={styles.empty}>
                        <Icon name="note" size={28} />
                        <p>{notes.length === 0 ? t('noteEmptyList') : t('noteNoMatch')}</p>
                    </div>
                    : <ul className={styles.rows}>
                        {shown.map(note => {
                            const checks = checklistCount(note.body);
                            return (
                                <li key={note.id}>
                                    <button type="button" className={styles.row} onClick={() => setOpenId(note.id)}>
                                        <span className={styles.rowTitle}>
                                            {note.pinned && <Icon name="pin" size={13} />}
                                            {titleOf(note) || t('noteUntitled')}
                                        </span>
                                        <NotePreview note={note} className={styles.rowPreview} />
                                        <span className={styles.rowMeta}>
                                            {checks.total > 0 && <span>{fill(t('noteChecks'), checks)}</span>}
                                            {note.attachments.length > 0 && <span><Icon name={note.attachments.some(a => a.kind === 'image') ? 'image' : 'link'} size={12} /> {note.attachments.length}</span>}
                                            <span>{dateFmt.format(new Date(note.updatedAt))}</span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>}
            {scanning && <ScanSheet onClose={() => setScanning(false)} onDone={onScanDone} />}
        </div>
    );
}
