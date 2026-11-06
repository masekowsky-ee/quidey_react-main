import { useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { updateGoal } from '../../features/study/study';
import { useFocusOnArrival } from '../../features/layout/dragDismiss';
import { toInputDate } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import { FormSheet } from '../QuickAdd.jsx';
import SheetGrabber from '../SheetGrabber.jsx';
import Icon from '../icons.jsx';
import ui from '../ui.module.css';
import { KINDS, useStudyError } from './studyUi';
import styles from './Study.module.css';
import own from './GoalSheet.module.css';

const NAME_MAX = 200;

// The settings of one goal (spec §5): name, kind, date + optional time, plan mode, and its status
// (done / archived, or active again). PATCH /goals/:id with only what changed.
// onClose(change): change = what was saved ({ status } for a status button), undefined when put away.
export default function GoalSettingsSheet({ goal, onClose }) {
    return (
        <FormSheet onClose={() => onClose(undefined)}>
            {(sheet, close) => <GoalSettingsForm goal={goal} sheet={sheet} close={close} onClose={onClose} />}
        </FormSheet>
    );
}

function GoalSettingsForm({ goal, sheet, close, onClose }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const errorText = useStudyError();
    const nameRef = useRef(null);
    useFocusOnArrival(nameRef);
    const [fields, setFields] = useState(() => ({
        name: goal.name, kind: goal.kind, due: goal.due, dueTime: goal.dueTime ?? '', planMode: goal.planMode,
    }));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const set = (changes) => { setFields(prev => ({ ...prev, ...changes })); setError(null); };
    const today = toInputDate(new Date());

    const save = async (change) => {
        setBusy(true);
        setError(null);
        try {
            if (Object.keys(change).length > 0) await dispatch(updateGoal(goal.id, change));
            close(() => onClose(change));
        } catch (err) {
            setError(errorText(err));
            setBusy(false);
        }
    };

    const submit = (e) => {
        e.preventDefault();
        const name = fields.name.trim();
        if (!name || !fields.due) {
            setError(t('studyGoalIncomplete'));
            return;
        }
        const change = {};
        if (name !== goal.name) change.name = name;
        if (fields.kind !== goal.kind) change.kind = fields.kind;
        if (fields.due !== goal.due) change.due = fields.due;
        if ((fields.dueTime || null) !== (goal.dueTime ?? null)) change.dueTime = fields.dueTime || null;
        if (fields.planMode !== goal.planMode) change.planMode = fields.planMode;
        save(change);
    };

    const titleId = 'goalSettingsTitle';
    return (
        <div className={own.panel} role="dialog" aria-modal="true" aria-labelledby={titleId} {...sheet.panel}>
            <SheetGrabber />
            <button type="button" className={own.close} onClick={() => close()} aria-label={t('close')}><Icon name="close" size={18} /></button>
            <div className={own.head} data-sheet-drag>
                <h2 id={titleId} className={own.title}>{t('studyEditGoal')}</h2>
            </div>
            <form className={own.form} noValidate onSubmit={submit}>
                <label className={own.field}>
                    <span className={own.label}>{t('studyGoalName')}</span>
                    <input ref={nameRef} type="text" value={fields.name} maxLength={NAME_MAX} onChange={(e) => set({ name: e.target.value })} />
                </label>
                <div className={own.field}>
                    <span className={own.label} id="goalSettingsKind">{t('studyGoalKind')}</span>
                    <div className={ui.segmented} role="radiogroup" aria-labelledby="goalSettingsKind">
                        {KINDS.map(kind => (
                            <button key={kind} type="button" role="radio" aria-checked={fields.kind === kind}
                                className={fields.kind === kind ? ui.segmentActive : undefined} onClick={() => set({ kind })}>
                                {t(`studyKind_${kind}`)}
                            </button>
                        ))}
                    </div>
                </div>
                <div className={own.two}>
                    <label className={own.field}>
                        <span className={own.label}>{t('studyGoalDue')}</span>
                        <input type="date" value={fields.due} min={today} onChange={(e) => set({ due: e.target.value })} />
                    </label>
                    <label className={own.field}>
                        <span className={own.label}>{t('studyGoalDueTime')}</span>
                        <input type="time" value={fields.dueTime} onChange={(e) => set({ dueTime: e.target.value })} />
                    </label>
                </div>
                <div className={own.field}>
                    <span className={own.label} id="goalSettingsMode">{t('studyPlanMode')}</span>
                    <div className={ui.segmented} role="radiogroup" aria-labelledby="goalSettingsMode">
                        {['days', 'slots'].map(mode => (
                            <button key={mode} type="button" role="radio" aria-checked={fields.planMode === mode}
                                className={fields.planMode === mode ? ui.segmentActive : undefined} onClick={() => set({ planMode: mode })}>
                                {t(`studyPlanMode_${mode}`)}
                            </button>
                        ))}
                    </div>
                </div>
                <div className={styles.actions}>
                    {goal.status === 'active' ? (
                        <>
                            <button type="button" className={styles.btn} disabled={busy} onClick={() => save({ status: 'done' })}>{t('studyMarkDone')}</button>
                            <button type="button" className={styles.btn} disabled={busy} onClick={() => save({ status: 'archived' })}>{t('studyArchiveGoal')}</button>
                        </>
                    ) : (
                        <button type="button" className={styles.btn} disabled={busy} onClick={() => save({ status: 'active' })}>{t('studyReactivate')}</button>
                    )}
                </div>
                {error && <p className={own.error} role="alert">{error}</p>}
                <div className={own.footer}>
                    <button type="button" className={styles.btn} disabled={busy} onClick={() => close()}>{t('studyCancel')}</button>
                    <button type="submit" className={styles.btnPrimary} disabled={busy}>{t('studySave')}</button>
                </div>
            </form>
        </div>
    );
}
