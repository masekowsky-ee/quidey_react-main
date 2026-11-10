import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPlanPreview, applyPlan, selectPlanPreview, formatHours } from '../../features/study/study';
import { fill, parseDate, mondayIndex, toInputDate } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import { FormSheet } from '../QuickAdd.jsx';
import SheetGrabber from '../SheetGrabber.jsx';
import Icon from '../icons.jsx';
import { Bone, Skeleton } from '../skeleton/Skeleton.jsx';
import GoalShape from './GoalShape.jsx';
import { useStudyError } from './studyUi';
import styles from './Study.module.css';
import own from './GoalSheet.module.css';

// the minutes a goal is short, from the planner's shortfall ({ goalId: minutes } or a list)
function shortfallOf(shortfall, goalId) {
    if (Array.isArray(shortfall)) return shortfall.find(s => s.goalId === goalId)?.minutes ?? 0;
    return Number(shortfall?.[goalId] ?? 0);
}

// "Di 12.11. 16:00" (no time: "Di 12.11.")
function useWhen() {
    const { t } = useTranslation();
    return (at) => {
        const day = parseDate(at?.date);
        if (!day) return '';
        const text = `${t('weekDays', mondayIndex(day))} ${day.getDate()}.${day.getMonth() + 1}.`;
        return at.time ? `${text} ${at.time}` : text;
    };
}

function summaryText(summary, t) {
    const parts = [];
    if (summary.moved > 0) parts.push(fill(t(summary.moved === 1 ? 'studySummaryMoved_one' : 'studySummaryMoved'), { n: summary.moved }));
    if (summary.added > 0) parts.push(fill(t('studySummaryNew'), { n: summary.added }));
    if (summary.dropped > 0) parts.push(fill(t(summary.dropped === 1 ? 'studySummaryDropped_one' : 'studySummaryDropped'), { n: summary.dropped }));
    return parts.length > 0 ? parts.join(' · ') : t('studySummaryUnchanged');
}

// "2026-11-12" + n days
function shiftDay(date, days) {
    const day = parseDate(date);
    if (!day) return date;
    return toInputDate(new Date(day.getFullYear(), day.getMonth(), day.getDate() + days));
}

// The goal's whole plan as sessions: from the server's `sessions` (each with a key, so it can be
// moved), or, from an older server, from the changes (shown, not movable).
function sessionsOf(group) {
    if (Array.isArray(group.sessions)) return group.sessions;
    return group.changes
        .filter(c => c.type !== 'dropped')
        .map((c, i) => ({ key: null, id: `c${i}`, partName: c.partName, date: c.to.date, time: c.to.time ?? null, minutes: c.minutes, change: c.type, from: c.from }));
}

const bySlot = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
    || (a.time != null) - (b.time != null)
    || String(a.time ?? '').localeCompare(String(b.time ?? ''));

// One planned session in the agenda: the topic, its time and length, what is new about it. A tap
// opens the place to move it (a day back / on, the day, the time, back to the planner's place).
// day: the day it is listed under (while it is being moved it stays there and says its new day)
function SessionRow({ session, moved, day, open, onToggle, onMove, onReset }) {
    const { t } = useTranslation();
    const when = useWhen();
    const movable = session.key != null;
    const at = moved ?? session;
    const tag = moved ? t('studyPreviewMovedByYou')
        : session.change === 'new' ? t('studyPreviewNew')
        : session.change === 'moved' ? fill(t('studyPreviewWas'), { when: when(session.from) })
        : null;
    const meta = [at.date !== day ? when(at) : at.time, `${session.minutes} ${t('studyMinutes')}`].filter(Boolean).join(' · ');
    const editorId = `plan-move-${session.key ?? session.id}`;
    const inner = <>
        <span className={own.sessionName}>{session.partName}</span>
        <span className={own.sessionMeta}>{meta}</span>
        {tag && <span className={own.sessionTag} data-kind={moved ? 'yours' : session.change}>
            {moved && <Icon name="pin" size={12} />}{tag}
        </span>}
    </>;
    return (
        <li className={own.session} data-open={open || undefined}>
            {movable ? (
                <button type="button" className={own.sessionMain} aria-expanded={open} aria-controls={editorId} data-tip="plan-session"
                    aria-label={`${session.partName}, ${when(at)}${tag ? `, ${tag}` : ''}. ${t('studyPreviewMove')}`}
                    onClick={onToggle}>
                    {inner}
                    <Icon name="chevronDown" size={16} className={own.sessionChevron} />
                </button>
            ) : <div className={own.sessionMain}>{inner}</div>}
            {open && movable && (
                <div id={editorId} className={own.mover} role="group" aria-label={fill(t('studyPreviewMoveLabel'), { name: session.partName })}>
                    <button type="button" className={own.moverStep} onClick={() => onMove({ ...at, date: shiftDay(at.date, -1) })}
                        aria-label={t('studyPreviewDayBack')} title={t('studyPreviewDayBack')}>
                        <Icon name="chevronDown" size={16} className={own.back} />
                    </button>
                    <label className={own.moverField}>
                        <span className={own.moverLabel}>{t('studyPreviewDay')}</span>
                        <input type="date" value={at.date} required
                            onChange={e => { if (e.target.value) onMove({ ...at, date: e.target.value }); }} />
                    </label>
                    <label className={own.moverField}>
                        <span className={own.moverLabel}>{t('studyPreviewTime')}</span>
                        <input type="time" value={at.time ?? ''} step={300}
                            onChange={e => onMove({ ...at, time: e.target.value || null })} />
                    </label>
                    <button type="button" className={own.moverStep} onClick={() => onMove({ ...at, date: shiftDay(at.date, 1) })}
                        aria-label={t('studyPreviewDayOn')} title={t('studyPreviewDayOn')}>
                        <Icon name="chevronDown" size={16} className={own.on} />
                    </button>
                    {moved && <button type="button" className={own.moverReset} onClick={onReset}>{t('studyPreviewReset')}</button>}
                </div>
            )}
        </li>
    );
}

// One goal's plan as an agenda: a day column (weekday, the date large) beside that day's sessions.
// Sessions moved here stand on their new day. Sessions that go away are listed at the end.
// open: { key, day } of the session being moved: it stays under the day it had when it was opened
// (its row isn't pulled away from under the finger or the keyboard) and takes its new place once closed.
function GoalAgenda({ group, missing, kind, shape, color, showSummary, moves, setMove, open, setOpen }) {
    const { t, language } = useTranslation();
    const when = useWhen();
    const rowKey = (s) => s.key ?? s.id;
    const sessions = sessionsOf(group)
        .map(s => (s.key != null && moves[s.key] ? { ...s, ...moves[s.key], moved: moves[s.key] } : s))
        .map(s => ({ ...s, day: open?.key === rowKey(s) ? open.day : s.date }))
        .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0) || bySlot(a, b));
    const days = [];
    for (const s of sessions) {
        const last = days.at(-1);
        if (last && last.date === s.day) last.sessions.push(s);
        else days.push({ date: s.day, sessions: [s] });
    }
    const dropped = group.changes.filter(c => c.type === 'dropped');

    return (
        <section className={own.group} aria-label={group.name} role="group" data-task-color={color || undefined}>
            <header className={own.groupHead}>
                <GoalShape shape={shape} size={14} className={own.groupShape} />
                <h3 className={own.groupName}>{group.name}</h3>
                {showSummary && <p className={own.summary}>{summaryText(group.summary, t)}</p>}
            </header>
            {missing > 0 && (
                <p className={own.banner} role="status">{fill(t(`studyShortfall_${kind}`), { hours: formatHours(missing, language) })}</p>
            )}
            {days.length > 0 && (
                <ol className={own.agenda}>
                    {days.map(day => {
                        const date = parseDate(day.date);
                        return (
                            <li key={day.date} className={own.day}>
                                <div className={own.dayLabel} aria-hidden="true">
                                    <span className={own.dayWeek}>{date ? t('weekDays', mondayIndex(date)) : ''}</span>
                                    <span className={own.dayNumber}>{date ? date.getDate() : ''}</span>
                                    <span className={own.dayMonth}>{date ? `${date.getMonth() + 1}.` : ''}</span>
                                </div>
                                <ul className={own.daySessions} aria-label={when({ date: day.date })}>
                                    {day.sessions.map(s => (
                                        <SessionRow key={rowKey(s)} session={s} moved={s.moved} day={s.day}
                                            open={open?.key === rowKey(s)}
                                            onToggle={() => setOpen(open?.key === rowKey(s) ? null : { key: rowKey(s), day: s.day })}
                                            onMove={(at) => setMove(s.key, s, at)}
                                            onReset={() => setMove(s.key, s, null)} />
                                    ))}
                                </ul>
                            </li>
                        );
                    })}
                </ol>
            )}
            {dropped.length > 0 && (
                <div className={own.dropped}>
                    <p className={own.droppedTitle}>{fill(t(dropped.length === 1 ? 'studySummaryDropped_one' : 'studySummaryDropped'), { n: dropped.length })}</p>
                    <ul className={own.droppedList}>
                        {dropped.map((c, i) => (
                            <li key={i}>
                                <span className={own.droppedName}>{c.partName}</span>
                                <span className={own.droppedWhen}>{when(c.from)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

// The plan the planner proposes, per goal as an agenda of days. Sessions can be moved before
// applying (they are written pinned then: the planner leaves them where they were put).
// Übernehmen applies all of it or nothing; when the plan changed meanwhile (409) the fresh
// proposal is shown with a line saying so, and the moves made on the old one are let go.
// onCancel(): put the sheet away; onApplied(): the plan was applied.
export function PlanPreviewContent({ onCancel, onApplied }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const errorText = useStudyError();
    const preview = useSelector(selectPlanPreview);
    const goals = useSelector(state => state.study.goals);
    const subjects = useSelector(state => state.study.subjects);
    const [state, setState] = useState('loading');
    const [busy, setBusy] = useState(false);
    const [changed, setChanged] = useState(false);
    const [error, setError] = useState(null);
    // key -> { date, time }, for the preview with this hash
    const [moves, setMoves] = useState({ hash: null, byKey: {} });
    const [open, setOpen] = useState(null);
    const hash = preview?.inputHash ?? null;
    const byKey = useMemo(() => (moves.hash === hash ? moves.byKey : {}), [moves, hash]);

    useEffect(() => {
        let alive = true;
        dispatch(fetchPlanPreview())
            .then(() => { if (alive) setState('ready'); })
            .catch(() => { if (alive) setState('error'); });
        return () => { alive = false; };
    }, [dispatch]);

    // at: { date, time } or null (back to where the planner put it)
    const setMove = (key, session, at) => {
        if (key == null) return;
        const next = { ...byKey };
        if (!at || (at.date === session.date && (at.time ?? null) === (session.time ?? null))) delete next[key];
        else next[key] = { date: at.date, time: at.time ?? null };
        setMoves({ hash, byKey: next });
    };

    const apply = async () => {
        setBusy(true);
        setError(null);
        try {
            const list = Object.entries(byKey).map(([key, at]) => ({ key: Number(key), date: at.date, time: at.time }));
            await dispatch(applyPlan(preview.inputHash, list));
            onApplied();
        } catch (err) {
            if (err.code === 'plan_changed') { setChanged(true); setOpen(null); }
            else setError(errorText(err));
            setBusy(false);
        }
    };

    if (state === 'loading' || (state === 'ready' && !preview)) {
        return (
            <Skeleton className={own.rows} aria-label={t('studyPreviewLoading')}>
                {[0, 1, 2].map(i => <Bone key={i} h="3rem" />)}
            </Skeleton>
        );
    }
    if (state === 'error') {
        return (
            <>
                <p className={own.error} role="alert">{t('studyPreviewError')}</p>
                <div className={own.footer}>
                    <button type="button" className={styles.btn} onClick={onCancel}>{t('close')}</button>
                </div>
            </>
        );
    }

    const movedCount = Object.keys(byKey).length;
    const unchanged = preview.goals.every(g => g.summary.moved + g.summary.added + g.summary.dropped === 0);
    const nothing = unchanged && movedCount === 0;
    // a goal that doesn't fit is not "everything fits": then only its banner and Schließen
    const short = preview.goals.some(g => shortfallOf(preview.shortfall, g.goalId) > 0);
    const anyMovable = preview.goals.some(g => sessionsOf(g).some(s => s.key != null));
    const colorOf = (goalId) => subjects.find(s => s.id === goals[goalId]?.subjectId)?.color ?? null;
    return (
        <>
            {changed && <p className={own.notice} role="status">{t('studyPlanChanged')}</p>}
            {anyMovable && <p className={own.hint}>{t('studyPreviewMoveHint')}</p>}
            {preview.goals.map(group => (
                <GoalAgenda key={group.goalId} group={group}
                    missing={shortfallOf(preview.shortfall, group.goalId)}
                    kind={goals[group.goalId]?.kind ?? 'other'}
                    shape={goals[group.goalId]?.shape}
                    color={colorOf(group.goalId)}
                    showSummary={!unchanged}
                    moves={byKey} setMove={setMove}
                    open={open} setOpen={setOpen} />
            ))}
            {nothing && !short && <p className={own.hint}>{t('studyPlanNothing')}</p>}
            {error && <p className={own.error} role="alert">{error}</p>}
            <div className={own.footer}>
                {movedCount > 0 && <p className={own.footerNote}>{fill(t(movedCount === 1 ? 'studyPreviewMovedCount_one' : 'studyPreviewMovedCount'), { n: movedCount })}</p>}
                {nothing ? (
                    <button type="button" className={styles.btn} onClick={onCancel}>{t('close')}</button>
                ) : (
                    <>
                        <button type="button" className={styles.btn} disabled={busy} onClick={onCancel}>{t('studyCancel')}</button>
                        <button type="button" className={styles.btnPrimary} disabled={busy} onClick={apply}>{t('studyApply')}</button>
                    </>
                )}
            </div>
        </>
    );
}

// The preview as its own sheet ("Neu planen", the Home card). onDone(applied?) when it is closed.
export default function PlanPreview({ onDone }) {
    const { t } = useTranslation();
    return (
        <FormSheet onClose={() => onDone?.(false)}>
            {(sheet, close) => (
                <div className={own.panel} role="dialog" aria-modal="true" aria-labelledby="planPreviewTitle" {...sheet.panel}>
                    <SheetGrabber />
                    <button type="button" className={own.close} onClick={close} aria-label={t('close')}><Icon name="close" size={18} /></button>
                    <div className={own.head} data-sheet-drag>
                        <h2 id="planPreviewTitle" className={own.title}>{t('studyPreviewTitle')}</h2>
                    </div>
                    <PlanPreviewContent onCancel={close} onApplied={() => onDone?.(true)} />
                </div>
            )}
        </FormSheet>
    );
}
