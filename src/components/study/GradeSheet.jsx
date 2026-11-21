import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchStudySettings, updateGoal } from '../../features/study/study';
import { GRADE_RANGE, formatGrade, parseGrade } from '../../features/study/grades';
import { useFocusOnArrival } from '../../features/layout/dragDismiss';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import { FormSheet } from '../QuickAdd.jsx';
import SheetForm from './SheetForm.jsx';
import { useSubmit } from './useSubmit.js';
import { useStudyLoad } from './useStudyLoad.js';
import styles from './Study.module.css';
import own from './GoalSheet.module.css';

// A grade for a finished goal, typed in the account's scale (points 0-15 or marks 1-6); skippable.
// onClose(): put away (saved, cleared or skipped).
export default function GradeSheet({ goal, onClose }) {
    return (
        <FormSheet onClose={onClose}>
            {(sheet, close) => <GradeForm goal={goal} sheet={sheet} close={close} onClose={onClose} />}
        </FormSheet>
    );
}

function GradeForm({ goal, sheet, close, onClose }) {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const scale = useSelector(state => state.study.settings?.gradeScale) ?? 'points';
    const inputRef = useRef(null);
    useFocusOnArrival(inputRef);
    const [value, setValue] = useState(goal.grade == null ? '' : formatGrade(goal.grade, language));
    const { run: save, busy, error, setError } = useSubmit(async (grade) => {
        await dispatch(updateGoal(goal.id, { grade }));
        close(() => onClose());
    });
    const [min, max] = GRADE_RANGE[scale];

    // the scale comes with the settings, which may not be loaded yet
    useStudyLoad((d) => [d(fetchStudySettings())]);

    const submit = (e) => {
        e.preventDefault();
        const grade = parseGrade(value, scale);
        if (grade == null) {
            setError(fill(t('studyGradeInvalid'), { min, max }));
            return;
        }
        save(grade);
    };

    return (
        <SheetForm sheet={sheet} close={close} title={t('studyGradeTitle')} onSubmit={submit} error={error} busy={busy}
            cancelLabel={t('studyGradeSkip')}
            extra={goal.grade != null && (
                <button type="button" className={styles.btn} disabled={busy} onClick={() => save(null)}>{t('studyGradeClear')}</button>
            )}>
            <p className={own.hint}>{goal.name}</p>
            <label className={own.field}>
                <span className={own.label}>{t(`studyGradeLabel_${scale}`)}</span>
                <input ref={inputRef} type="text" inputMode="decimal" value={value} maxLength={5}
                    onChange={(e) => { setValue(e.target.value); setError(null); }} />
            </label>
        </SheetForm>
    );
}
