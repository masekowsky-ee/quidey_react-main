import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchRoutines, saveRoutine, deleteRoutine, templateRoutine, planText, totalMinutes, ROUTINE_TEMPLATES, ROUTINE_EMOJIS, readRoutineRun } from '../../features/routines/routines';
import { showToast } from '../../features/toast/toast';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import ConfirmDeleteButton from '../ConfirmDeleteButton.jsx';
import { Bone } from '../skeleton/Skeleton.jsx';
import Icon from '../icons.jsx';
import RoutineRunner from './RoutineRunner.jsx';
import styles from './Routines.module.css';

const EMPTY = { name: '', emoji: '✨', steps: [{ title: '', minutes: 5 }], days: [], atTime: null, remind: true };
const STEP_MINUTES = [0, 1, 2, 3, 5, 10, 15, 20, 25, 30, 45, 60];

// Making or changing a routine: name and emoji, the steps (title + minutes, moved up/down),
// and the plan (weekdays, time of day, reminder)
function RoutineEditor({ initial, onClose }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [routine, setRoutine] = useState(() => ({ ...EMPTY, ...initial, steps: (initial?.steps ?? EMPTY.steps).map(step => ({ ...step })) }));
    const [saving, setSaving] = useState(false);
    const set = (change) => setRoutine(prev => ({ ...prev, ...change }));
    const setStep = (i, change) => set({ steps: routine.steps.map((step, j) => j === i ? { ...step, ...change } : step) });
    const moveStep = (i, by) => {
        const steps = [...routine.steps];
        const [step] = steps.splice(i, 1);
        steps.splice(i + by, 0, step);
        set({ steps });
    };
    const toggleDay = (day) => set({ days: routine.days.includes(day) ? routine.days.filter(d => d !== day) : [...routine.days, day].sort() });
    const valid = routine.name.trim() && routine.steps.some(step => step.title.trim());

    const submit = async (e) => {
        e.preventDefault();
        if (!valid || saving) return;
        setSaving(true);
        try {
            await dispatch(saveRoutine({ ...routine, name: routine.name.trim(), steps: routine.steps.filter(step => step.title.trim()).map(step => ({ title: step.title.trim(), minutes: Number(step.minutes) || 0 })) }));
            dispatch(showToast(t('routineSaved'), 'success'));
            onClose();
        } catch (err) {
            dispatch(showToast(err.code === 'ROUTINE_LIMIT' ? t('routineLimit') : t('routineSaveFailed'), 'error'));
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="routine-editor-title" onKeyDown={e => e.key === 'Escape' && onClose()}>
            <form className={styles.sheet} onSubmit={submit}>
                <div className={styles.sheetHead}>
                    <h2 id="routine-editor-title">{routine.id ? t('routineEdit') : t('routineNew')}</h2>
                    <button type="button" className={styles.iconBtn} onClick={onClose} aria-label={t('close')}><Icon name="close" size={18} /></button>
                </div>

                <div className={styles.nameRow}>
                    <label className={styles.field}>
                        <span>{t('routineName')}</span>
                        <input autoFocus value={routine.name} maxLength={60} onChange={e => set({ name: e.target.value })} placeholder={t('routineNamePlaceholder')} required />
                    </label>
                </div>
                <div className={styles.emojiRow} role="radiogroup" aria-label={t('routineEmoji')}>
                    {ROUTINE_EMOJIS.map(emoji =>
                        <button key={emoji} type="button" role="radio" aria-checked={routine.emoji === emoji} onClick={() => set({ emoji })}>{emoji}</button>)}
                </div>

                <fieldset className={styles.stepsField}>
                    <legend>{t('routineSteps')}</legend>
                    <ol className={styles.editSteps}>
                        {routine.steps.map((step, i) =>
                            <li key={i}>
                                <span className={styles.stepNo}>{i + 1}</span>
                                <input value={step.title} maxLength={80} onChange={e => setStep(i, { title: e.target.value })}
                                    placeholder={t('routineStepPlaceholder')} aria-label={fill(t('routineStepN'), { n: i + 1 })} />
                                <select value={step.minutes} onChange={e => setStep(i, { minutes: Number(e.target.value) })} aria-label={t('routineStepMinutes')}>
                                    {[...new Set([...STEP_MINUTES, step.minutes])].sort((a, b) => a - b).map(m =>
                                        <option key={m} value={m}>{m === 0 ? t('routineNoTimerShort') : fill(t('minutesShort'), { n: m })}</option>)}
                                </select>
                                <div className={styles.stepBtns}>
                                    <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label={t('routineStepUp')}>↑</button>
                                    <button type="button" onClick={() => moveStep(i, 1)} disabled={i === routine.steps.length - 1} aria-label={t('routineStepDown')}>↓</button>
                                    <button type="button" onClick={() => set({ steps: routine.steps.filter((_, j) => j !== i) })} disabled={routine.steps.length === 1} aria-label={t('routineStepRemove')}>
                                        <Icon name="close" size={14} />
                                    </button>
                                </div>
                            </li>)}
                    </ol>
                    {routine.steps.length < 30 &&
                        <button type="button" className={styles.addStep} onClick={() => set({ steps: [...routine.steps, { title: '', minutes: 5 }] })}>
                            <Icon name="plus" size={16} /> {t('routineAddStep')}
                        </button>}
                    <p className={styles.hint}>{fill(t('routineTotal'), { n: totalMinutes(routine) })}</p>
                </fieldset>

                <fieldset className={styles.planField}>
                    <legend>{t('routinePlan')}</legend>
                    <div className={styles.days} role="group" aria-label={t('routineDays')}>
                        {[1, 2, 3, 4, 5, 6, 7].map(day =>
                            <button key={day} type="button" aria-pressed={routine.days.includes(day)} onClick={() => toggleDay(day)}>{t('weekDays', day - 1)}</button>)}
                    </div>
                    <div className={styles.planRow}>
                        <label className={styles.field}>
                            <span>{t('routineTime')}</span>
                            <input type="time" value={routine.atTime ?? ''} onChange={e => set({ atTime: e.target.value || null })} />
                        </label>
                        <label className={styles.check}>
                            <input type="checkbox" checked={routine.remind} onChange={e => set({ remind: e.target.checked })} disabled={!routine.atTime || routine.days.length === 0} />
                            {t('routineRemind')}
                        </label>
                    </div>
                    <p className={styles.hint}>{routine.days.length === 0 ? t('routinePlanHintNone') : t('routinePlanHint')}</p>
                </fieldset>

                <div className={styles.sheetActions}>
                    <button type="button" className={styles.ghost} onClick={onClose}>{t('cancel')}</button>
                    <button type="submit" className={styles.primary} disabled={!valid || saving}>{t('save')}</button>
                </div>
            </form>
        </div>
    );
}

function RoutineCard({ routine, onEdit }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    return (
        <li className={styles.card}>
            <span className={styles.cardEmoji} aria-hidden="true">{routine.emoji || '✨'}</span>
            <div className={styles.cardText}>
                <h3 className={styles.cardName}>{routine.name}</h3>
                <p className={styles.cardMeta}>
                    <span>{fill(t(routine.steps.length === 1 ? 'routineStepsOne' : 'routineStepsCount'), { n: routine.steps.length })} · {fill(t('minutesShort'), { n: totalMinutes(routine) })}</span>
                    <span>{planText(routine, t)}</span>
                    {routine.doneToday && <span className={styles.doneBadge}><Icon name="check" size={12} strokeWidth={2.5} /> {t('routineDoneToday')}</span>}
                    {routine.runsThisWeek > 0 && <span>{fill(t('routineRunsWeek'), { n: routine.runsThisWeek })}</span>}
                </p>
            </div>
            <div className={styles.cardActions}>
                <button type="button" className={styles.ghost} onClick={() => navigate(`/routines/${routine.id}/run`)}>
                    <Icon name="play" size={16} strokeWidth={2} /> {t('routineStart')}
                </button>
                <button type="button" className={styles.iconBtn} onClick={() => onEdit(routine)} aria-label={`${t('routineEdit')}: ${routine.name}`} title={t('routineEdit')}>
                    <Icon name="edit" size={18} />
                </button>
                <ConfirmDeleteButton label={`${t('delete')}: ${routine.name}`} onConfirm={() => dispatch(deleteRoutine(routine.id)).catch(() => dispatch(showToast(t('routineSaveFailed'), 'error')))} />
            </div>
        </li>
    );
}

// Routinen (/routines): my routines with start / edit / delete, ready-made ones to begin with,
// and the guided run (/routines/:id/run)
export default function Routines() {
    const { t, language } = useTranslation();
    const dispatch = useDispatch();
    const { id } = useParams();
    const { list, loaded } = useSelector(state => state.routines);
    const [editing, setEditing] = useState(null);

    useEffect(() => { dispatch(fetchRoutines()).catch(() => {}); }, [dispatch]);

    if (id) {
        const routine = list.find(item => String(item.id) === id);
        return (
            <div className={styles.page}>
                {routine ? <RoutineRunner key={routine.id} routine={routine} />
                    : loaded ? <p className={styles.missing}>{t('routineMissing')} <Link to="/routines">{t('routineBackToList')}</Link></p>
                    : <Bone h="20rem" />}
            </div>
        );
    }

    const pending = readRoutineRun();
    const pendingRoutine = pending && list.find(item => item.id === pending.routineId);
    return (
        <div className={styles.page}>
            <header className={styles.head}>
                <div>
                    <h1 className={styles.title}>{t('routines')}</h1>
                    <p className={styles.subtitle}>{t('routinesSubtitle')}</p>
                </div>
                <button type="button" className={styles.primary} onClick={() => setEditing({})}><Icon name="plus" size={16} /> {t('routineNew')}</button>
            </header>

            {pendingRoutine &&
                <Link to={`/routines/${pendingRoutine.id}/run`} className={styles.resume}>
                    <Icon name="play" size={16} /> {fill(t('routineResume'), { name: pendingRoutine.name })}
                </Link>}

            {!loaded
                ? <ul className={styles.cards}>{[0, 1].map(i => <li key={i}><Bone h="5rem" /></li>)}</ul>
                : list.length === 0
                    ? <p className={styles.emptyText}>{t('routinesEmpty')}</p>
                    : <ul className={styles.cards}>{list.map(routine => <RoutineCard key={routine.id} routine={routine} onEdit={setEditing} />)}</ul>}

            <section aria-labelledby="templates-title" className={styles.templates}>
                <h2 id="templates-title" className={styles.sectionTitle}>{t('routineTemplates')}</h2>
                <p className={styles.subtitle}>{t('routineTemplatesHint')}</p>
                <ul className={styles.templateGrid}>
                    {ROUTINE_TEMPLATES.map(template => {
                        const preview = templateRoutine(template, language);
                        return (
                            <li key={template.key}>
                                <button type="button" className={styles.template} onClick={() => setEditing(preview)}>
                                    <span className={styles.cardEmoji} aria-hidden="true">{template.emoji}</span>
                                    <span className={styles.templateName}>{preview.name}</span>
                                    <span className={styles.templateMeta}>{fill(t('routineStepsCount'), { n: preview.steps.length })} · {fill(t('minutesShort'), { n: totalMinutes(preview) })}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </section>

            {editing && <RoutineEditor initial={editing} onClose={() => setEditing(null)} />}
        </div>
    );
}
