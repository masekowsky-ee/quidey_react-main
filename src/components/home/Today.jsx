import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectTimerInProgress } from '../../features/session/sessionAction';
import { routinesForDay } from '../../features/routines/routines';
import { createNote } from '../../features/focus/notebook';
import { FOCUS_GOALS, readStoredFocusGoal, storeFocusGoal } from '../../features/settings/preferences';
import { showToast } from '../../features/toast/toast';
import { fill, formatClock, parseDate, sameDay, dueText, isOverdue } from '../../features/helperFunction';
import { isEvent } from '../../features/tasks/kinds';
import { selectTasksLoaded } from '../../features/tasks/taskAction';
import { Bone } from '../skeleton/Skeleton.jsx';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './Today.module.css';

const RING = 2 * Math.PI * 26;

// Focus today against my daily goal: a small ring, the minutes, a way into the Fokusraum
function FocusGoal() {
    const { t } = useTranslation();
    const serverMin = useSelector(state => state.progress.data?.todayFocusMin ?? 0);
    // the session going on now isn't saved yet: it counts already
    const runningSec = useSelector(state => state.session.currentSessionData.totalTime);
    const running = useSelector(selectTimerInProgress);
    const time = useSelector(state => state.session.timer.time);
    const [goal, setGoal] = useState(readStoredFocusGoal);
    const minutes = serverMin + Math.floor(runningSec / 60);
    const share = Math.min(1, minutes / goal);

    return (
        <section className={styles.card} aria-labelledby="today-focus">
            <h2 id="today-focus" className={styles.cardTitle}><Icon name="timer" size={16} /> {t('dashFocusTitle')}</h2>
            <div className={styles.goalRow}>
                <svg className={styles.ring} viewBox="0 0 60 60" aria-hidden="true">
                    <circle className={styles.ringTrack} cx="30" cy="30" r="26" />
                    <circle className={styles.ringFill} cx="30" cy="30" r="26" strokeDasharray={RING} strokeDashoffset={RING * (1 - share)} />
                </svg>
                <div>
                    <p className={styles.big}>{fill(t('dashFocusMinutes'), { n: minutes })}</p>
                    <label className={styles.goalPick}>
                        <span>{t('dashFocusGoal')}</span>
                        <select value={goal} onChange={e => { const g = Number(e.target.value); setGoal(g); storeFocusGoal(g); }}>
                            {FOCUS_GOALS.map(g => <option key={g} value={g}>{fill(t('minutesShort'), { n: g })}</option>)}
                        </select>
                    </label>
                </div>
            </div>
            <Link to="/focus" className={styles.cardAction}>
                {running ? fill(t('dashFocusRunning'), { time: formatClock(time) }) : share >= 1 ? t('dashFocusReached') : t('dashFocusStart')}
                <Icon name="arrowRight" size={16} />
            </Link>
        </section>
    );
}

// Routines planned for today, with their time; start one with a tap
function RoutinesToday() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { list, loaded } = useSelector(state => state.routines);
    const today = routinesForDay(list);
    return (
        <section className={styles.card} aria-labelledby="today-routines">
            <h2 id="today-routines" className={styles.cardTitle}><Icon name="routine" size={16} /> {t('dashRoutinesTitle')}</h2>
            {!loaded ? <Bone h="4.5rem" />
                : today.length === 0
                ? <p className={styles.muted}>{list.length === 0 ? t('dashRoutinesNone') : t('dashRoutinesNoneToday')}</p>
                : <ul className={styles.list}>
                    {today.slice(0, 3).map(routine =>
                        <li key={routine.id} data-done={routine.doneToday || undefined}>
                            <span className={styles.emoji} aria-hidden="true">{routine.emoji || '✨'}</span>
                            <span className={styles.itemText}>
                                <span className={styles.itemName}>{routine.name}</span>
                                <span className={styles.itemMeta}>{routine.doneToday ? t('routineDoneToday') : routine.atTime ?? t('dashAnyTime')}</span>
                            </span>
                            {!routine.doneToday &&
                                <button type="button" className={styles.startBtn} onClick={() => navigate(`/routines/${routine.id}/run`)} aria-label={`${t('routineStart')}: ${routine.name}`}>
                                    <Icon name="play" size={14} strokeWidth={2} />
                                </button>}
                        </li>)}
                </ul>}
            <Link to="/routines" className={styles.cardAction}>{list.length === 0 ? t('dashRoutinesCreate') : t('dashRoutinesAll')} <Icon name="arrowRight" size={16} /></Link>
        </section>
    );
}

// What comes next: today's coming events and the tasks due soonest
function UpNext({ tasks }) {
    const { t } = useTranslation();
    const loaded = useSelector(selectTasksLoaded);
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const items = useMemo(() => tasks
        .filter(task => !task.done && task.due)
        .filter(task => {
            const due = parseDate(task.due);
            if (!due) return false;
            if (isEvent(task)) return due > now || (sameDay(due, now) && (!task.due_time || task.due_time.slice(0, 5) >= hhmm));
            return !isOverdue(task, now);
        })
        .sort((a, b) => `${a.due}${a.due_time ?? '99'}`.localeCompare(`${b.due}${b.due_time ?? '99'}`))
        .slice(0, 3),
    // the minute is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, hhmm]);
    const overdue = tasks.filter(task => isOverdue(task, now)).length;

    return (
        <section className={styles.card} aria-labelledby="today-next">
            <h2 id="today-next" className={styles.cardTitle}><Icon name="calendar" size={16} /> {t('dashNextTitle')}</h2>
            {!loaded ? <Bone h="4.5rem" />
                : items.length === 0
                ? <p className={styles.muted}>{t('dashNextNone')}</p>
                : <ul className={styles.list}>
                    {items.map(task =>
                        <li key={task.id}>
                            <span className={styles.kindDot} data-event={isEvent(task) || undefined} aria-hidden="true" />
                            <span className={styles.itemText}>
                                <span className={styles.itemName}>{task.name}</span>
                                <span className={styles.itemMeta}>{dueText(task.due, t)}{task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ''}</span>
                            </span>
                        </li>)}
                </ul>}
            {overdue > 0
                ? <Link to="/calendar?view=agenda" className={`${styles.cardAction} ${styles.warn}`}>{fill(t('overdueCount'), { count: overdue })} <Icon name="arrowRight" size={16} /></Link>
                : <Link to="/calendar" className={styles.cardAction}>{t('dashNextCalendar')} <Icon name="arrowRight" size={16} /></Link>}
        </section>
    );
}

// A thought written down in passing: goes into the notebook (Fokusraum)
function QuickNote() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [text, setText] = useState('');
    const [saving, setSaving] = useState(false);
    const save = async (e) => {
        e.preventDefault();
        if (!text.trim() || saving) return;
        setSaving(true);
        try {
            await createNote({ title: '', body: text.trim() });
            setText('');
            dispatch(showToast(t('dashNoteSaved'), 'success', { to: '/focus' }));
        } catch {
            dispatch(showToast(t('noteSaveFailed'), 'error'));
        } finally {
            setSaving(false);
        }
    };
    return (
        <form className={styles.card} onSubmit={save} aria-labelledby="today-note">
            <h2 id="today-note" className={styles.cardTitle}><Icon name="note" size={16} /> {t('dashNoteTitle')}</h2>
            <textarea className={styles.note} value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={2000}
                placeholder={t('dashNotePlaceholder')} aria-label={t('dashNoteTitle')}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(e); }} />
            <div className={styles.noteFoot}>
                <Link to="/focus" className={styles.cardActionInline}>{t('dashNoteAll')}</Link>
                <button type="submit" className={styles.saveBtn} disabled={!text.trim() || saving}>{t('save')}</button>
            </div>
        </form>
    );
}

// Home's dashboard: the day at a glance, between the motivation strip and the week. Four quiet
// cards side by side on wide screens, two by two on tablets, a swipe row on phones.
export default function Today({ tasks }) {
    const { t } = useTranslation();
    return (
        <div className={styles.grid} data-part="home-today" aria-label={t('dashTitle')}>
            <FocusGoal />
            <RoutinesToday />
            <UpNext tasks={tasks} />
            <QuickNote />
        </div>
    );
}
