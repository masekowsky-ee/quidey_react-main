import { useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { saveSubject } from '../../features/study/study';
import { useFocusOnArrival } from '../../features/layout/dragDismiss';
import { useTranslation } from '../../i18n/useTranslation';
import { FormSheet } from '../QuickAdd.jsx';
import SheetForm from './SheetForm.jsx';
import { useSubmit } from './useSubmit.js';
import TaskColorPicker from '../task/TaskColorPicker.jsx';
import own from './GoalSheet.module.css';

const SUBJECT_NAME_MAX = 60;
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
    const nameRef = useRef(null);
    useFocusOnArrival(nameRef);
    const [name, setName] = useState(subject.name);
    const [emoji, setEmoji] = useState(subject.emoji ?? '');
    const [color, setColor] = useState(subject.color ?? null);
    const { run: save, busy, error, setError } = useSubmit(async (change) => {
        await dispatch(saveSubject(subject.id, change));
        close();
    }, (err, errorText) => (err.code === 'subject_exists' ? t('studySubjectExists') : errorText(err)));

    const submit = (e) => {
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
        save(change);
    };

    return (
        <SheetForm sheet={sheet} close={close} title={t('studyEditSubject')} onSubmit={submit} error={error} busy={busy}>
            <div className={own.two}>
                <label className={own.field}>
                    <span className={own.label}>{t('studySubjectName')}</span>
                    <input ref={nameRef} type="text" value={name} maxLength={SUBJECT_NAME_MAX} onChange={(e) => { setName(e.target.value); setError(null); }} />
                </label>
                <label className={own.field}>
                    <span className={own.label}>{t('studySubjectEmoji')}</span>
                    <input type="text" value={emoji} maxLength={EMOJI_MAX} onChange={(e) => setEmoji(e.target.value)} />
                </label>
            </div>
            <TaskColorPicker value={color} onChange={setColor} />
        </SheetForm>
    );
}
