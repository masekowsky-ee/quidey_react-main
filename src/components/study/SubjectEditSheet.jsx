import { useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { saveSubject } from '../../features/study/study';
import { useFocusOnArrival } from '../../features/layout/dragDismiss';
import { useTranslation } from '../../i18n/useTranslation';
import { FormSheet } from '../QuickAdd.jsx';
import SheetGrabber from '../SheetGrabber.jsx';
import Icon from '../icons.jsx';
import TaskColorPicker from '../task/TaskColorPicker.jsx';
import { useStudyError } from './studyUi';
import styles from './Study.module.css';
import own from './GoalSheet.module.css';

const NAME_MAX = 60;
const EMOJI_MAX = 16;

// Edit a subject (spec §5): name, emoji, colour (the task colours). Only what changed is sent;
// a new colour also recolours the subject's planned sessions (server).
export default function SubjectEditSheet({ subject, onClose }) {
    return (
        <FormSheet onClose={onClose}>
            {(sheet, close) => <SubjectForm subject={subject} sheet={sheet} close={close} />}
        </FormSheet>
    );
}

function SubjectForm({ subject, sheet, close }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const errorText = useStudyError();
    const nameRef = useRef(null);
    useFocusOnArrival(nameRef);
    const [name, setName] = useState(subject.name);
    const [emoji, setEmoji] = useState(subject.emoji ?? '');
    const [color, setColor] = useState(subject.color ?? null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError(t('studyError_invalid_input'));
            return;
        }
        const change = {};
        if (trimmed !== subject.name) change.name = trimmed;
        if ((emoji.trim() || null) !== (subject.emoji ?? null)) change.emoji = emoji.trim() || null;
        if (color !== (subject.color ?? null)) change.color = color;
        if (Object.keys(change).length === 0) {
            close();
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await dispatch(saveSubject(subject.id, change));
            close();
        } catch (err) {
            setError(err.code === 'subject_exists' ? t('studySubjectExists') : errorText(err));
            setBusy(false);
        }
    };

    const titleId = 'subjectEditTitle';
    return (
        <div className={own.panel} role="dialog" aria-modal="true" aria-labelledby={titleId} {...sheet.panel}>
            <SheetGrabber />
            <button type="button" className={own.close} onClick={() => close()} aria-label={t('close')}><Icon name="close" size={18} /></button>
            <div className={own.head} data-sheet-drag>
                <h2 id={titleId} className={own.title}>{t('studyEditSubject')}</h2>
            </div>
            <form className={own.form} noValidate onSubmit={submit}>
                <div className={own.two}>
                    <label className={own.field}>
                        <span className={own.label}>{t('studySubjectName')}</span>
                        <input ref={nameRef} type="text" value={name} maxLength={NAME_MAX} onChange={(e) => { setName(e.target.value); setError(null); }} />
                    </label>
                    <label className={own.field}>
                        <span className={own.label}>{t('studySubjectEmoji')}</span>
                        <input type="text" value={emoji} maxLength={EMOJI_MAX} onChange={(e) => setEmoji(e.target.value)} />
                    </label>
                </div>
                <TaskColorPicker value={color} onChange={setColor} />
                {error && <p className={own.error} role="alert">{error}</p>}
                <div className={own.footer}>
                    <button type="button" className={styles.btn} disabled={busy} onClick={() => close()}>{t('studyCancel')}</button>
                    <button type="submit" className={styles.btnPrimary} disabled={busy}>{t('studySave')}</button>
                </div>
            </form>
        </div>
    );
}
