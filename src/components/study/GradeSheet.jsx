import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchStudySettings, updateGoal } from '../../features/study/study';
import { GRADE_RANGE, formatGrade, parseGrade } from '../../features/study/grades';
import { useFocusOnArrival } from '../../features/layout/dragDismiss';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import { FormSheet } from '../QuickAdd.jsx';
import SheetGrabber from '../SheetGrabber.jsx';
import Icon from '../icons.jsx';
import { useStudyError } from './studyUi';
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
    const errorText = useStudyError();
    const scale = useSelector(state => state.study.settings?.gradeScale) ?? 'points';
    const inputRef = useRef(null);
    useFocusOnArrival(inputRef);
    const [value, setValue] = useState(goal.grade == null ? '' : formatGrade(goal.grade, language));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [min, max] = GRADE_RANGE[scale];

    // the scale comes with the settings, which may not be loaded yet
    useEffect(() => {
        dispatch(fetchStudySettings()).catch(() => {});
    }, [dispatch]);

    const save = async (grade) => {
        setBusy(true);
        setError(null);
        try {
            await dispatch(updateGoal(goal.id, { grade }));
            close(() => onClose());
        } catch (err) {
            setError(errorText(err));
            setBusy(false);
        }
    };

    const submit = (e) => {
        e.preventDefault();
        const grade = parseGrade(value, scale);
        if (grade == null) {
            setError(fill(t('studyGradeInvalid'), { min, max }));
            return;
        }
        save(grade);
    };

    const titleId = 'gradeSheetTitle';
    return (
        <div className={own.panel} role="dialog" aria-modal="true" aria-labelledby={titleId} {...sheet.panel}>
            <SheetGrabber />
            <button type="button" className={own.close} onClick={() => close()} aria-label={t('close')}><Icon name="close" size={18} /></button>
            <div className={own.head} data-sheet-drag>
                <h2 id={titleId} className={own.title}>{t('studyGradeTitle')}</h2>
            </div>
            <form className={own.form} noValidate onSubmit={submit}>
                <p className={own.hint}>{goal.name}</p>
                <label className={own.field}>
                    <span className={own.label}>{t(`studyGradeLabel_${scale}`)}</span>
                    <input ref={inputRef} type="text" inputMode="decimal" value={value} maxLength={5}
                        onChange={(e) => { setValue(e.target.value); setError(null); }} />
                </label>
                {error && <p className={own.error} role="alert">{error}</p>}
                <div className={own.footer}>
                    {goal.grade != null && (
                        <button type="button" className={styles.btn} disabled={busy} onClick={() => save(null)}>{t('studyGradeClear')}</button>
                    )}
                    <button type="button" className={styles.btn} disabled={busy} onClick={() => close()}>{t('studyGradeSkip')}</button>
                    <button type="submit" className={styles.btnPrimary} disabled={busy}>{t('studySave')}</button>
                </div>
            </form>
        </div>
    );
}
