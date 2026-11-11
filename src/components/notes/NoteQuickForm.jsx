// A note from the plus button (QuickAdd): title and text, written like everywhere else (the editor
// without visible marks, dictation in its tools), saved into the notebook in one go. The kind switch
// goes back to a task / event / reminder with the title. onKind(kind, title); onDone(): saved or closed.

import { useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { createNote, NOTE_BODY_MAX } from '../../features/focus/notebook';
import { showToast } from '../../features/toast/toast';
import { useFocusOnArrival } from '../../features/layout/dragDismiss';
import { useTranslation } from '../../i18n/useTranslation';
import SheetGrabber from '../SheetGrabber.jsx';
import { KindSwitch } from '../task/KindFields.jsx';
import NoteText from './NoteText.jsx';
import DictateButton from '../voice/DictateButton.jsx';
import MicButton from '../voice/MicButton.jsx';
import styles from '../Form.module.css';

export default function NoteQuickForm({ initialTitle = '', sheet, onKind, onDone }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [title, setTitle] = useState(initialTitle);
    const [busy, setBusy] = useState(false);
    // the editor hands over a way to read its text (worked out only when saving)
    const bodyOf = useRef(() => '');
    const titleRef = useRef(null);
    useFocusOnArrival(titleRef);

    async function save(e) {
        e.preventDefault();
        const body = bodyOf.current();
        if (!title.trim() && !body.trim()) { onDone(); return; }
        if (body.length > NOTE_BODY_MAX) { dispatch(showToast(t('noteTooLong'), 'error')); return; }
        setBusy(true);
        try {
            const note = await createNote({ title: title.trim(), body });
            dispatch(showToast(t('noteQuickSaved'), 'success', { to: `/notes?note=${note.id}` }));
            onDone();
        } catch (err) {
            dispatch(showToast(err.code === 'NOTEBOOK_LIMIT' ? t('noteLimit') : t('noteSaveFailed'), 'error'));
            setBusy(false);
        }
    }

    return (
        <div className={styles.div} role="dialog" aria-modal="true" aria-labelledby="createNoteTitle" {...sheet?.panel}>
            {sheet && <SheetGrabber />}
            <button type="button" className={styles.closeBtn} onClick={() => onDone()} aria-label={t('close')}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
            </button>
            <h2 id="createNoteTitle" data-sheet-drag>{t('createNoteH2')}</h2>
            <form className={styles.form} onSubmit={save} noValidate>
                <KindSwitch value="note" kinds={['task', 'event', 'reminder', 'note']}
                    onChange={(kind) => { if (kind !== 'note') onKind(kind, title); }} />
                <div className={styles.nameRow}>
                    <input ref={titleRef} className={`${styles.input} ${styles.grow}`} type="text" value={title} maxLength={120}
                        placeholder={t('noteTitlePlaceholder')} aria-label={t('noteQuickTitle')} onChange={e => setTitle(e.target.value)} />
                    <MicButton className={styles.nameMic} onText={(text) => setTitle(text.slice(0, 120))} />
                </div>
                <div className={styles.noteBody}>
                    <NoteText body="" label={t('noteText')} placeholder={t('notePlaceholder')}
                        onChange={(getBody) => { bodyOf.current = getBody; }}
                        tools={({ insertText }) => <DictateButton insert={insertText} />} />
                </div>
                <button type="submit" className={styles.createBtn} disabled={busy}>{t('noteQuickSave')}</button>
            </form>
        </div>
    );
}
