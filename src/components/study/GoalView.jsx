import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
    fetchGoal, fetchSubjects, deleteGoal, updateGoal, updatePart, addPart, deletePart, reorderParts, studyNow, unpinSession,
    selectGoal, selectSubjects, selectStudyStatus, formatHours, hoursNumber,
} from '../../features/study/study';
import { setFocusTask, startFocus } from '../../features/session/sessionAction';
import { showToast } from '../../features/toast/toast';
import { fill, formatDate } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import ConfirmDeleteButton from '../ConfirmDeleteButton.jsx';
import Icon from '../icons.jsx';
import { Bone, Skeleton } from '../skeleton/Skeleton.jsx';
import GoalProgress from './GoalProgress.jsx';
import GoalSettingsSheet from './GoalSettingsSheet.jsx';
import PlanPreview from './PlanPreview.jsx';
import { changesPlan, countdownText, goalStateKey, isPastGoal, useStudyError } from './studyUi';
import styles from './Study.module.css';

const STEP = 15;
const MIN = 15;
const MAX = 1200;
const NEW_PART_MINUTES = 60;
const NAME_MAX = 200;

const sum = (parts, key) => parts.reduce((total, p) => total + (p[key] ?? 0), 0);

// run(action): a change; replan(action): a change of the plan's input (estimate, order, delete), which
// offers the preview afterwards
function PartRow({ part, index, parts, goal, busy, run, replan, onStudyNow }) {
    const { t, language } = useTranslation();
    const done = Boolean(part.doneAt);
    const review = part.role === 'review';
    const next = parts[index + 1];
    const move = (by) => {
        const ids = parts.map(p => p.id);
        [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
        replan(() => reorderParts(goal.id, ids));
    };
    const step = (delta) => replan(() => updatePart(part.id, { estimateMinutes: Math.min(MAX, Math.max(MIN, part.estimateMinutes + delta)) }));
    const name = { name: part.name };

    return (
        <li className={styles.part}>
            <div className={styles.partMain}>
                <input type="checkbox" checked={done} disabled={busy} aria-label={fill(t('studyPartDone'), name)}
                    onChange={() => run(() => updatePart(part.id, { doneAt: done ? null : new Date().toISOString() }))} />
                <span className={styles.partText}>
                    <span className={done ? styles.partDone : undefined}>
                        {`${part.name} · ${hoursNumber(part.credit, language)} / ${formatHours(part.estimateMinutes, language)}`}
                    </span>
                    <span className={styles.source}>{t(`studySource_${part.estimateSource}`)}</span>
                </span>
            </div>

            <div className={styles.stepper}>
                <button type="button" className={styles.iconButton} disabled={busy || done || part.estimateMinutes <= MIN}
                    aria-label={fill(t('studyLess'), name)} onClick={() => step(-STEP)}>
                    <span aria-hidden="true">−</span>
                </button>
                <span className={styles.stepValue} aria-label={fill(t('studyEstimate'), name)}>{part.estimateMinutes} {t('studyMinutes')}</span>
                <button type="button" className={styles.iconButton} disabled={busy || done || part.estimateMinutes >= MAX}
                    aria-label={fill(t('studyMore'), name)} onClick={() => step(STEP)}>
                    <span aria-hidden="true">+</span>
                </button>
            </div>

            {!review && (
                <div className={styles.stepper}>
                    <button type="button" className={styles.iconButton} disabled={busy || index === 0}
                        aria-label={fill(t('studyMoveUp'), name)} onClick={() => move(-1)}>
                        <Icon name="arrowUp" size={16} />
                    </button>
                    <button type="button" className={styles.iconButton} disabled={busy || !next || next.role === 'review'}
                        aria-label={fill(t('studyMoveDown'), name)} onClick={() => move(1)}>
                        <Icon name="arrowDown" size={16} />
                    </button>
                </div>
            )}

            <button type="button" className={styles.btn} disabled={busy || done || goal.status !== 'active' || isPastGoal(goal)} onClick={() => onStudyNow(part)}>
                <Icon name="play" size={14} /> {t('studyStudyNow')}
            </button>
            <ConfirmDeleteButton label={fill(t('studyDeletePart'), name)} onConfirm={() => replan(() => deletePart(part.id))} />
        </li>
    );
}

// One goal: its parts (done, time, order, study now), the planned sessions, its settings, delete.
// "Neu planen" sets ?replan=1, where the plan preview opens. A saved change of date, time or mode opens
// the preview at once; a part edit only offers it in a quiet line (ruling 30: not on every stepper click).
export default function GoalView({ goalId }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const errorText = useStudyError();
    const goal = useSelector(selectGoal(goalId));
    const subjects = useSelector(selectSubjects);
    const status = useSelector(selectStudyStatus);
    const [missing, setMissing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [asking, setAsking] = useState(false);
    const [partName, setPartName] = useState('');
    const [editing, setEditing] = useState(false);
    const [preview, setPreview] = useState(false);
    const [prompt, setPrompt] = useState(false);

    useEffect(() => {
        dispatch(fetchGoal(goalId)).catch((err) => {
            if (err.status === 404) setMissing(true);
            else dispatch(showToast(t('studyError_default'), 'error'));
        });
        dispatch(fetchSubjects()).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, goalId]);

    const subject = goal && subjects.find(s => s.id === goal.subjectId);
    const behind = (status?.goals ?? []).some(g => g.goalId === goalId && g.behindMinutes > 0);
    const stateKey = goal ? goalStateKey(goal) : null;
    const parts = useMemo(() => goal?.parts ?? [], [goal]);
    const sessions = useMemo(() => [...(goal?.sessions ?? [])]
        .sort((a, b) => a.due.localeCompare(b.due) || (a.dueTime ?? '').localeCompare(b.dueTime ?? '')), [goal]);

    // the planner plans this goal: active and its day not over
    const planned = goal?.status === 'active' && !isPastGoal(goal);

    // runs a change and shows what went wrong as a toast; { replan: true } offers the preview after it
    const run = async (action, { replan = false } = {}) => {
        setBusy(true);
        try {
            await dispatch(action());
            if (replan && planned) setPrompt(true);
        } catch (err) {
            dispatch(showToast(errorText(err), 'error'));
        } finally {
            setBusy(false);
        }
    };

    const studyNowOn = async (part) => {
        setBusy(true);
        try {
            const { task } = await dispatch(studyNow(part.id));
            dispatch(setFocusTask(task));
            dispatch(startFocus());
        } catch (err) {
            dispatch(showToast(errorText(err), 'error'));
        } finally {
            setBusy(false);
        }
    };

    const addNewPart = async (e) => {
        e.preventDefault();
        const trimmed = partName.trim();
        if (!trimmed) return;
        await run(() => addPart(goalId, { name: trimmed, estimateMinutes: NEW_PART_MINUTES, estimateSource: 'manual' }), { replan: true });
        setPartName('');
    };

    const remove = async (sessionsChoice) => {
        setBusy(true);
        try {
            await dispatch(deleteGoal(goalId, sessionsChoice));
            navigate(`/study/${goal.subjectId}`);
        } catch (err) {
            setBusy(false);
            dispatch(showToast(errorText(err), 'error'));
        }
    };

    const setStatus = (status) => run(() => updateGoal(goalId, { status }));

    // the settings sheet put away: a new date, time or mode of a planned goal opens the preview
    const settingsClosed = (change) => {
        setEditing(false);
        if (!changesPlan(change)) return;
        const next = { ...goal, ...change };
        if (next.status === 'active' && !isPastGoal(next)) {
            setPrompt(false);
            setPreview(true);
        }
    };

    if (missing) {
        return (
            <div className={styles.page}>
                <Link to="/study" className={styles.back}>{t('studyBack')}</Link>
                <p className={styles.empty}>{t('studyGoalNotFound')}</p>
            </div>
        );
    }

    if (!goal) {
        return (
            <Skeleton className={styles.page} aria-label={t('loading')}>
                <Bone w="8rem" h="1rem" />
                <Bone w="16rem" h="1.75rem" />
                <Bone h="0.5rem" />
                {[0, 1, 2].map(i => <Bone key={i} h="3.5rem" />)}
            </Skeleton>
        );
    }

    return (
        <div className={styles.page} data-part="study-goal">
            <Link to={`/study/${goal.subjectId}`} className={styles.back}>{subject ? subject.name : t('studyBackSubject')}</Link>
            <header className={styles.head}>
                <div>
                    <h1 className={styles.title}>{goal.name}</h1>
                    <p className={styles.subtitle}>
                        {[t(`studyKind_${goal.kind}`), `${formatDate(goal.due)}${goal.dueTime ? ` ${goal.dueTime}` : ''}`, countdownText(goal.due, t)].join(' · ')}
                        {behind && <> <span className={styles.badge}>{t('studyBehind')}</span></>}
                        {stateKey && <> <span className={styles.badgeQuiet}>{t(stateKey)}</span></>}
                    </p>
                </div>
                <div className={styles.actions}>
                    <button type="button" className={styles.btn} onClick={() => navigate({ search: '?replan=1' })}>{t('studyReplan')}</button>
                    <button type="button" className={styles.btn} onClick={() => setEditing(true)}>
                        <Icon name="edit" size={14} /> {t('studyEditGoal')}
                    </button>
                    <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => setAsking(v => !v)} aria-expanded={asking}>
                        <Icon name="trash" size={14} /> {t('studyDeleteGoal')}
                    </button>
                </div>
            </header>

            {asking && (
                <div className={styles.ask} role="group" aria-label={t('studyDeleteGoal')}>
                    <p>{t('studyDeleteGoalAsk')}</p>
                    <div className={styles.actions}>
                        <button type="button" className={`${styles.btn} ${styles.danger}`} disabled={busy} onClick={() => remove('delete')}>{t('studyDeleteSessions')}</button>
                        <button type="button" className={styles.btn} disabled={busy} onClick={() => remove('keep')}>{t('studyKeepSessions')}</button>
                        <button type="button" className={styles.btn} onClick={() => setAsking(false)}>{t('studyDeleteCancel')}</button>
                    </div>
                </div>
            )}

            {goal.status === 'active' && isPastGoal(goal) && (
                <div className={styles.ask} role="group" aria-label={t('studyGoalPast')}>
                    <p>{t('studyGoalPastHint')}</p>
                    <div className={styles.actions}>
                        <button type="button" className={styles.btn} disabled={busy} onClick={() => setStatus('done')}>{t('studyMarkDone')}</button>
                        <button type="button" className={styles.btn} disabled={busy} onClick={() => setStatus('archived')}>{t('studyArchiveGoal')}</button>
                    </div>
                </div>
            )}

            {prompt && planned && (
                <div className={styles.replanCard} role="status">
                    <p className={styles.replanText}>{t('studyAdjustPlan')}</p>
                    <button type="button" className={styles.btn} onClick={() => setPreview(true)}>{t('studySeePlan')}</button>
                </div>
            )}

            <GoalProgress credit={sum(parts, 'credit')} estimate={sum(parts, 'estimateMinutes')} />

            <h2 className={styles.sectionTitle}>{t('studyParts')}</h2>
            {parts.length === 0 ? <p className={styles.empty}>{t('studyPartsEmpty')}</p> : (
                <ul className={styles.list}>
                    {parts.map((part, index) => (
                        <PartRow key={part.id} part={part} index={index} parts={parts} goal={goal} busy={busy} run={run}
                            replan={(action) => run(action, { replan: true })} onStudyNow={studyNowOn} />
                    ))}
                </ul>
            )}
            <form className={styles.newRow} onSubmit={addNewPart}>
                <input value={partName} maxLength={NAME_MAX} onChange={e => setPartName(e.target.value)}
                    placeholder={t('studyNewPart')} aria-label={t('studyNewPart')} />
                <button type="submit" className={styles.btn} disabled={busy || !partName.trim()}>
                    <Icon name="plus" size={14} /> {t('studyAddPart')}
                </button>
            </form>

            <h2 className={styles.sectionTitle}>{t('studySessions')}</h2>
            {sessions.length === 0 ? <p className={styles.empty}>{t('studySessionsEmpty')}</p> : (
                <ul className={styles.sessions}>
                    {sessions.map(session => (
                        <li key={session.taskId} className={styles.session}>
                            <span>{formatDate(session.due)}{session.dueTime ? ` ${session.dueTime}` : ''}</span>
                            <span>{parts.find(p => p.id === session.partId)?.name}</span>
                            <span>{session.minutes} {t('studyMinutes')}</span>
                            {session.done && <span className={styles.source}>{t('studySessionDone')}</span>}
                            {session.pinned && !session.done && <span className={styles.source}>{t('studySessionPinned')}</span>}
                            {session.pinned && !session.done && (
                                <button type="button" className={styles.btn} disabled={busy} onClick={() => run(() => unpinSession(session.taskId))}>{t('studyUnpin')}</button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {editing && <GoalSettingsSheet goal={goal} onClose={settingsClosed} />}
            {preview && <PlanPreview onDone={() => { setPreview(false); setPrompt(false); }} />}
        </div>
    );
}
