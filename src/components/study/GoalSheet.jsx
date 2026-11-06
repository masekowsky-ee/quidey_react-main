import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
    fetchSubjects, fetchStudySettings, saveSubject, createGoal, deletePart, estimateParts,
    selectSubjects, selectStudySettings,
} from '../../features/study/study';
import { parseParts, pageCount, MAX_PARTS } from '../../features/study/parseParts';
import { useFocusOnArrival } from '../../features/layout/dragDismiss';
import { fill, toInputDate } from '../../features/helperFunction';
import { showToast } from '../../features/toast/toast';
import { useTranslation } from '../../i18n/useTranslation';
import { FormSheet } from '../QuickAdd.jsx';
import SheetGrabber from '../SheetGrabber.jsx';
import Icon from '../icons.jsx';
import ui from '../ui.module.css';
import { PlanPreviewContent } from './PlanPreview.jsx';
import { KINDS, useStudyError } from './studyUi';
import styles from './Study.module.css';
import own from './GoalSheet.module.css';

const STEP = 15;
const MIN = 15;
const MAX = 1200;
const NAME_MAX = 200;
const SUBJECT_MAX = 60;
const NEW_SUBJECT = 'new';
const DEFAULT_MINUTES = { exam: 120, assignment: 180, presentation: 90, other: 120 };
const DEBOUNCE_MS = 400;

// The same rule as the server: 15 % of the other estimates, 60-240 (shown only; the server adds the part)
const reviewMinutes = (minutes) => Math.min(240, Math.max(60, Math.round(minutes.reduce((s, m) => s + m, 0) * 0.15)));

// New goal in three steps: kind / name / subject / date / mode, then the topics with their estimates,
// then the plan preview. Opened by ?new=goal; onClose removes the parameter. A created goal is opened
// when the sheet ends.
export default function GoalSheet({ subjectId = null, onClose }) {
    const navigate = useNavigate();
    const [created, setCreatedState] = useState(null);
    // the sheet's close handler may be an older closure: read the goal from a ref
    const createdRef = useRef(null);
    const setCreated = (goal) => { createdRef.current = goal; setCreatedState(goal); };
    const finish = () => {
        if (createdRef.current) navigate(`/study/goals/${createdRef.current.id}`);
        else onClose();
    };
    return (
        <FormSheet onClose={finish}>
            {(sheet, close) => (
                <GoalForm sheet={sheet} close={close} subjectId={subjectId} created={created} setCreated={setCreated} done={finish} />
            )}
        </FormSheet>
    );
}

function GoalForm({ sheet, close, subjectId, created, setCreated, done }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const errorText = useStudyError();
    const subjects = useSelector(selectSubjects).filter(s => !s.archived);
    const settings = useSelector(selectStudySettings);
    const nameRef = useRef(null);
    useFocusOnArrival(nameRef);

    const [step, setStep] = useState(1);
    const [fields, setFields] = useState(() => ({
        // planMode null: not picked yet, see `planMode` below
        kind: 'exam', name: '', subject: subjectId == null ? '' : String(subjectId), newSubject: '', due: '', dueTime: '', planMode: null,
    }));
    const set = (changes) => { setFields(prev => ({ ...prev, ...changes })); setError(null); };
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [noWindows, setNoWindows] = useState(false);

    const [text, setText] = useState('');
    // estimate per part name: { minutes, source }; a manual one is never overwritten
    const [known, setKnown] = useState({});
    const [estimating, setEstimating] = useState(false);
    const [aiFailed, setAiFailed] = useState(false);
    const [reviewOn, setReviewOn] = useState(true);
    const requestId = useRef(0);
    // AI answers per part name for the sheet's lifetime (null: asked, no AI answer): a name is sent to the AI once
    const aiCache = useRef({});
    const [aiRunning, setAiRunning] = useState(false);

    useEffect(() => {
        dispatch(fetchSubjects()).catch(() => {});
        if (!settings) dispatch(fetchStudySettings()).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const exam = fields.kind === 'exam';
    const names = useMemo(() => parseParts(text).slice(0, exam && reviewOn ? MAX_PARTS - 1 : MAX_PARTS), [text, exam, reviewOn]);
    const subject = subjects.find(s => String(s.id) === fields.subject);
    const inline = fields.subject === NEW_SUBJECT || (subjects.length === 0 && fields.subject === '');
    const subjectName = inline ? fields.newSubject.trim() : subject?.name ?? '';
    const aiAvailable = Boolean(settings?.aiAvailable);
    const autoAi = aiAvailable && Boolean(settings?.aiAuto);
    // in the study times when there are any, else on days (spec: slots by default), until one is picked
    const planMode = fields.planMode ?? (settings?.windows?.length > 0 ? 'slots' : 'days');
    const today = toInputDate(new Date());
    const subjectFields = () => ({
        ...(subject && !inline ? { subjectId: subject.id } : {}),
        subjectName: subjectName.slice(0, SUBJECT_MAX), kind: fields.kind, due: fields.due,
    });
    // an AI answer the sheet already has beats a plain default
    const remember = (name, e) => (e.source === 'default' && aiCache.current[name]) || { minutes: e.minutes, source: e.source };
    const keepAi = (names, estimates) => names.forEach((name, i) => {
        const e = estimates?.[i];
        aiCache.current[name] = e?.source === 'ai' ? { minutes: e.minutes, source: 'ai' } : aiCache.current[name] ?? null;
    });

    const estimate = async (ai) => {
        if (names.length === 0 || !subjectName) return;
        const id = ++requestId.current;
        setEstimating(true);
        try {
            // ai: false says so even with "automatisch" on: the runs while typing never use the AI (ruling 32)
            const result = await dispatch(estimateParts({ ...subjectFields(), parts: names, ai }));
            if (ai) keepAi(names, result.estimates);
            if (id !== requestId.current) return;
            setKnown(prev => {
                const next = { ...prev };
                names.forEach((name, i) => {
                    const e = result.estimates?.[i];
                    if (e && next[name]?.source !== 'manual') next[name] = remember(name, e);
                });
                return next;
            });
            setAiFailed(Boolean(result.aiFailed));
        } catch {
            if (id !== requestId.current) return;
            // an estimate that failed: the defaults, so the goal can still be made
            setKnown(prev => {
                const next = { ...prev };
                for (const name of names) if (!next[name]) next[name] = remember(name, { minutes: DEFAULT_MINUTES[fields.kind], source: 'default' });
                return next;
            });
        } finally {
            if (id === requestId.current) setEstimating(false);
        }
    };

    // "automatisch" on: leaving the list asks the AI once for the names nothing else could estimate
    // (source 'default', or not estimated yet) and that weren't sent before
    const estimateWithAi = async () => {
        if (!autoAi || !subjectName) return;
        const open = names.filter(name => !(name in aiCache.current) && (known[name] == null || known[name].source === 'default'));
        if (open.length === 0) return;
        for (const name of open) aiCache.current[name] = null;
        setAiRunning(true);
        try {
            const result = await dispatch(estimateParts({ ...subjectFields(), parts: open, ai: true }));
            keepAi(open, result.estimates);
            setKnown(prev => {
                const next = { ...prev };
                open.forEach((name, i) => {
                    const e = result.estimates?.[i];
                    if (e && next[name]?.source !== 'manual') next[name] = remember(name, e);
                });
                return next;
            });
            setAiFailed(Boolean(result.aiFailed));
        } catch {
            // the plain estimates stay
        } finally {
            setAiRunning(false);
        }
    };

    // entering step 2 and every change of the list: a plain estimate after a short pause
    const namesKey = names.join('\n');
    useEffect(() => {
        if (step !== 2 || names.length === 0) return undefined;
        const timer = setTimeout(() => estimate(false), DEBOUNCE_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, namesKey]);

    const rows = names.map(name => ({ name, ...known[name] }));
    const ready = names.length > 0 && !estimating && !aiRunning && rows.every(r => r.minutes != null);
    const reviewMin = exam && reviewOn ? reviewMinutes(rows.map(r => r.minutes ?? DEFAULT_MINUTES.exam)) : 0;

    const change = (name, delta) => setKnown(prev => ({
        ...prev,
        [name]: { minutes: Math.min(MAX, Math.max(MIN, (prev[name]?.minutes ?? DEFAULT_MINUTES[fields.kind]) + delta)), source: 'manual' },
    }));

    const step1Valid = fields.name.trim() && fields.due >= today && (inline ? fields.newSubject.trim() : subject);

    const goNext = () => {
        if (!step1Valid) {
            setError(t(fields.due && fields.due < today ? 'studyError_due_in_past' : 'studyGoalIncomplete'));
            return;
        }
        setStep(2);
    };

    const submit = async () => {
        if (!ready) return;
        setBusy(true);
        setError(null);
        try {
            const latest = settings ?? await dispatch(fetchStudySettings());
            if (planMode === 'slots' && !(latest?.windows?.length > 0)) {
                setNoWindows(true);
                setStep(3);
                return;
            }
            let id = subject?.id;
            if (inline) {
                try {
                    id = (await dispatch(saveSubject(null, { name: fields.newSubject.trim() }))).id;
                    // the subject exists now: a retry after a failed createGoal must pick it, not create it again
                    setFields(prev => ({ ...prev, subject: String(id), newSubject: '' }));
                } catch (err) {
                    setStep(1);
                    setError(err.code === 'subject_exists' ? t('studySubjectExists') : errorText(err));
                    return;
                }
            }
            const goal = await dispatch(createGoal({
                subjectId: id, kind: fields.kind, name: fields.name.trim(), due: fields.due,
                ...(fields.dueTime ? { dueTime: fields.dueTime } : {}), planMode,
                parts: rows.map(r => ({ name: r.name, estimateMinutes: r.minutes, estimateSource: r.source })),
            }));
            setCreated(goal);
            if (exam && !reviewOn) {
                // the server always adds the review part to an exam: no review wanted, so it goes again
                const review = goal.parts?.find(p => p.role === 'review');
                if (review) await dispatch(deletePart(review.id)).catch((err) => dispatch(showToast(errorText(err), 'error')));
            }
            setStep(3);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setBusy(false);
        }
    };

    const titleId = 'goalSheetTitle';
    return (
        <div className={own.panel} role="dialog" aria-modal="true" aria-labelledby={titleId} {...sheet.panel}>
            <SheetGrabber />
            <button type="button" className={own.close} onClick={close} aria-label={t('close')}><Icon name="close" size={18} /></button>
            <div className={own.head} data-sheet-drag>
                <h2 id={titleId} className={own.title}>{t('studyNewGoal')}</h2>
                <span className={own.step}>{fill(t('studyStep'), { n: step })}</span>
            </div>

            {step === 1 && (
                <form className={own.form} noValidate onSubmit={(e) => { e.preventDefault(); goNext(); }}>
                    <div className={own.field}>
                        <span className={own.label} id="goalKindLabel">{t('studyGoalKind')}</span>
                        <div className={ui.segmented} role="radiogroup" aria-labelledby="goalKindLabel">
                            {KINDS.map(kind => (
                                <button key={kind} type="button" role="radio" aria-checked={fields.kind === kind}
                                    className={fields.kind === kind ? ui.segmentActive : undefined} onClick={() => set({ kind })}>
                                    {t(`studyKind_${kind}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className={own.field}>
                        <span className={own.label}>{t('studyGoalName')}</span>
                        <input ref={nameRef} type="text" value={fields.name} maxLength={NAME_MAX}
                            placeholder={t('studyGoalNamePlaceholder')} onChange={(e) => set({ name: e.target.value })} />
                    </label>
                    <label className={own.field}>
                        <span className={own.label}>{t('studyGoalSubject')}</span>
                        <select value={inline && subjects.length > 0 ? NEW_SUBJECT : fields.subject}
                            onChange={(e) => set({ subject: e.target.value })}>
                            <option value="" disabled>{t('studyGoalSubjectPick')}</option>
                            {subjects.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                            <option value={NEW_SUBJECT}>{t('studyNewSubjectOption')}</option>
                        </select>
                    </label>
                    {inline && (
                        <label className={own.field}>
                            <span className={own.label}>{t('studyNewSubjectName')}</span>
                            <input type="text" value={fields.newSubject} maxLength={SUBJECT_MAX} onChange={(e) => set({ newSubject: e.target.value })} />
                        </label>
                    )}
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
                        <span className={own.label} id="goalModeLabel">{t('studyPlanMode')}</span>
                        <div className={ui.segmented} role="radiogroup" aria-labelledby="goalModeLabel">
                            {['days', 'slots'].map(mode => (
                                <button key={mode} type="button" role="radio" aria-checked={planMode === mode}
                                    className={planMode === mode ? ui.segmentActive : undefined} onClick={() => set({ planMode: mode })}>
                                    {t(`studyPlanMode_${mode}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                    {error && <p className={own.error} role="alert">{error}</p>}
                    <div className={own.footer}>
                        <button type="submit" className={styles.btnPrimary}>{t('studyNext')}</button>
                    </div>
                </form>
            )}

            {step === 2 && (
                <div className={own.form}>
                    <label className={own.field}>
                        <span className={own.label}>{t('studyPartsLabel')}</span>
                        <textarea className={own.parts} value={text} onChange={(e) => { setText(e.target.value); setError(null); }}
                            onBlur={estimateWithAi} placeholder={t('studyPartsPlaceholder')} />
                    </label>
                    <p className={own.hint}>{t('studyPartsHint')}</p>
                    {aiAvailable && (
                        <div>
                            <button type="button" className={styles.btn} disabled={estimating || aiRunning || names.length === 0} onClick={() => estimate(true)}>
                                {t('studyAiEstimate')}
                            </button>
                        </div>
                    )}
                    {aiFailed && <p className={own.notice} role="status">{t('studyAiFailed')}</p>}
                    {(names.length > 0 || reviewMin > 0) && (
                        <ul className={own.rows}>
                            {rows.map(row => <EstimateRow key={row.name} row={row} kind={fields.kind} onChange={change} />)}
                            {reviewMin > 0 && (
                                <li className={own.row}>
                                    <span className={own.rowName}>
                                        <span>{t('studyReviewName')}</span>
                                        <span className={styles.source}>{t('studyReviewSource')}</span>
                                    </span>
                                    <span className={styles.stepValue}>{reviewMin} {t('studyMinutes')}</span>
                                    <button type="button" className={styles.btn} onClick={() => setReviewOn(false)}>{t('studyRemoveReview')}</button>
                                </li>
                            )}
                        </ul>
                    )}
                    {exam && !reviewOn && (
                        <div>
                            <button type="button" className={styles.btn} onClick={() => setReviewOn(true)}>{t('studyAddReview')}</button>
                        </div>
                    )}
                    {error && <p className={own.error} role="alert">{error}</p>}
                    <div className={own.footer}>
                        <button type="button" className={styles.btn} disabled={busy} onClick={() => { setStep(1); setError(null); }}>{t('studyBackStep')}</button>
                        <button type="button" className={styles.btnPrimary} disabled={!ready || busy} onClick={submit}>{t('studySeePlan')}</button>
                    </div>
                </div>
            )}

            {step === 3 && noWindows && (
                <div className={own.form}>
                    <p className={own.notice}>{t('studyNoWindows')}</p>
                    <p className={own.hint}>{t('studyNoWindowsHint')}</p>
                    <div className={own.footer}>
                        <button type="button" className={styles.btn} onClick={() => { setNoWindows(false); setStep(2); }}>{t('studyBackStep')}</button>
                        <Link to="/settings#study" className={styles.btn}>{t('studyOpenSettings')}</Link>
                    </div>
                </div>
            )}

            {step === 3 && !noWindows && created && (
                <PlanPreviewContent onCancel={close} onApplied={done} />
            )}
        </div>
    );
}

function EstimateRow({ row, kind, onChange }) {
    const { t } = useTranslation();
    const label = { name: row.name };
    const value = row.minutes ?? DEFAULT_MINUTES[kind];
    let source = null;
    if (row.source) {
        const pages = row.source === 'pages' ? pageCount(row.name) : null;
        source = pages ? fill(t('studySourcePages'), { n: pages }) : t(`studySource_${row.source}`);
    }
    return (
        <li className={own.row}>
            <span className={own.rowName}>
                <span>{row.name}</span>
                <span className={styles.source}>{source}</span>
            </span>
            <div className={styles.stepper}>
                <button type="button" className={styles.iconButton} disabled={row.minutes == null || value <= MIN}
                    aria-label={fill(t('studyLess'), label)} onClick={() => onChange(row.name, -STEP)}>
                    <span aria-hidden="true">−</span>
                </button>
                <span className={styles.stepValue} aria-label={fill(t('studyEstimate'), label)}>
                    {row.minutes == null ? '…' : `${row.minutes} ${t('studyMinutes')}`}
                </span>
                <button type="button" className={styles.iconButton} disabled={row.minutes == null || value >= MAX}
                    aria-label={fill(t('studyMore'), label)} onClick={() => onChange(row.name, STEP)}>
                    <span aria-hidden="true">+</span>
                </button>
            </div>
        </li>
    );
}
