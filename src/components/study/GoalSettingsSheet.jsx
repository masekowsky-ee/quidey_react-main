import { useId, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { updateGoal } from '../../features/study/study';
import { useFocusOnArrival } from '../../features/layout/dragDismiss';
import { toInputDate } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import { useSelector } from 'react-redux';
import { selectSubjects } from '../../features/study/study';
import { ShapePicker } from './GoalShape.jsx';
import { FormSheet } from '../QuickAdd.jsx';
import SheetForm from './SheetForm.jsx';
import { useSubmit } from './useSubmit.js';
import ui from '../ui.module.css';
import { KINDS } from './studyUi';
import styles from './Study.module.css';
import own from './GoalSheet.module.css';

const GOAL_NAME_MAX = 200;

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
    const nameRef = useRef(null);
    useFocusOnArrival(nameRef);
    const [fields, setFields] = useState(() => ({
        name: goal.name, kind: goal.kind, due: goal.due, dueTime: goal.dueTime ?? '', planMode: goal.planMode,
        studyFrom: goal.studyFrom ?? '', studyTo: goal.studyTo ?? '',
        shape: goal.shape ?? 'circle',
    }));
    const subjectColor = useSelector(selectSubjects).find(s => s.id === goal.subjectId)?.color;
    const { run: save, busy, error, setError } = useSubmit(async (change) => {
        if (Object.keys(change).length > 0) await dispatch(updateGoal(goal.id, change));
        close(() => onClose(change));
    });
    const set = (changes) => { setFields(prev => ({ ...prev, ...changes })); setError(null); };
    const today = toInputDate(new Date());
    // a plan needs topics; "only a date" is for a goal that has none
    const hasParts = (goal.parts?.length ?? 0) > 0;

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
        if (fields.studyFrom && fields.studyTo && fields.studyFrom > fields.studyTo) {
            setError(t('studyError_window'));
            return;
        }
        // the window of a date-only goal isn't used (and its fields are hidden)
        if (fields.studyFrom !== (goal.studyFrom ?? '')) change.studyFrom = fields.studyFrom || null;
        if (fields.studyTo !== (goal.studyTo ?? '')) change.studyTo = fields.studyTo || null;
        if (fields.shape !== (goal.shape ?? 'circle')) change.shape = fields.shape;
        save(change);
    };

    const kindId = useId();
    const modeId = useId();
    return (
        <SheetForm sheet={sheet} close={close} title={t('studyEditGoal')} onSubmit={submit} error={error} busy={busy}>
            <label className={own.field}>
                <span className={own.label}>{t('studyGoalName')}</span>
                <input ref={nameRef} type="text" value={fields.name} maxLength={GOAL_NAME_MAX} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <div className={own.field}>
                <span className={own.label} id={kindId}>{t('studyGoalKind')}</span>
                <div className={ui.segmented} role="radiogroup" aria-labelledby={kindId}>
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
                <span className={own.label} id={modeId}>{t('studyPlanMode')}</span>
                <div className={ui.segmented} role="radiogroup" aria-labelledby={modeId}>
                    {['days', 'slots', 'none'].map(mode => (
                        <button key={mode} type="button" role="radio" aria-checked={fields.planMode === mode}
                            disabled={mode === 'none' ? hasParts : !hasParts}
                            className={fields.planMode === mode ? ui.segmentActive : undefined} onClick={() => set({ planMode: mode })}>
                            {t(`studyPlanMode_${mode}`)}
                        </button>
                    ))}
                </div>
                {!hasParts && <p className={own.hint}>{t('studyDateOnlyNeedsParts')}</p>}
            </div>
            {fields.planMode !== 'none' && (
                <div className={own.two}>
                    <label className={own.field}>
                        <span className={own.label}>{t('studyWindowFrom')}</span>
                        <input type="date" value={fields.studyFrom} min={today} onChange={(e) => set({ studyFrom: e.target.value })} />
                    </label>
                    <label className={own.field}>
                        <span className={own.label}>{t('studyWindowTo')}</span>
                        <input type="date" value={fields.studyTo} min={fields.studyFrom || today} onChange={(e) => set({ studyTo: e.target.value })} />
                    </label>
                </div>
            )}
            <ShapePicker value={fields.shape} onChange={(shape) => set({ shape })} color={subjectColor} />
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
        </SheetForm>
    );
}
