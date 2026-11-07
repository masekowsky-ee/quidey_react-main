import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import styles from './DayPlan.module.css';
import TaskEditDialog from '../task/TaskEditDialog.jsx';
import { Bone } from '../skeleton/Skeleton.jsx';
import { useTranslation } from '../../i18n/useTranslation';
import { fill, parseDate, sameDay } from '../../features/helperFunction';
import { isEvent } from '../../features/tasks/kinds';
import { endOf } from '../../features/tasks/eventTimes';
import { selectTasksLoaded } from '../../features/tasks/taskAction';
import { routinesForDay } from '../../features/routines/routines';
import { FOCUS_GOALS, readStoredFocusGoal, storeFocusGoal } from '../../features/settings/preferences';

const hhmm = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

// Today in order of the clock: the events (also the ones already over, quieter), the tasks that
// have a time, the routines planned for today; "now" between what is over and what comes. Events
// without a time stand first. Under it, today's focus against the daily goal.
export default function DayPlan({ tasks }) {
    const { t, language } = useTranslation();
    const loaded = useSelector(selectTasksLoaded);
    const routines = useSelector(state => state.routines.list);
    const [open, setOpen] = useState(null);
    const now = new Date();
    const nowText = hhmm(now);

    const items = useMemo(() => {
        const today = new Date();
        const isToday = (task) => { const due = parseDate(task.due); return due && sameDay(due, today); };
        const fromTasks = tasks
            .filter(task => !task.shared && isToday(task) && (isEvent(task) || (task.due_time && !task.done)))
            .map(task => {
                const start = task.due_time?.slice(0, 5) ?? null;
                const end = isEvent(task) && start ? endOf(start, task.duration_minutes) : '';
                return { key: `t${task.id}`, time: start, end, name: task.name, place: task.location, task, done: task.done };
            });
        const fromRoutines = routinesForDay(routines, today).map(routine => ({
            key: `r${routine.id}`, time: routine.atTime ?? null, name: `${routine.emoji ? `${routine.emoji} ` : ''}${routine.name}`,
            routine, done: routine.doneToday,
        }));
        return [...fromTasks, ...fromRoutines].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    }, [tasks, routines]);

    // "now" goes before the first timed thing still to come
    const nowAt = items.findIndex(item => item.time && item.time > nowText);
    const date = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'numeric' }).format(now);
    const taskInEditor = open && tasks.find(task => task.id === open);

    const row = (item) => {
        const sub = [item.place, item.end && fill(t('homeDayUntil'), { time: item.end })].filter(Boolean).join(' · ');
        const body = <>
            <span className={styles.time}>{item.time ?? t('homeDayAllDay')}</span>
            <span className={styles.what}>
                <span className={styles.name}>{item.name}</span>
                {sub && <small>{sub}</small>}
            </span>
        </>;
        return (
            <li key={item.key} data-done={item.done || undefined}>
                {item.routine
                    ? <Link to={`/routines/${item.routine.id}/run`} className={styles.item}>{body}</Link>
                    : <button type="button" className={styles.item} onClick={() => setOpen(item.task.id)}>{body}</button>}
            </li>
        );
    };
    const nowRow = <li key="now" className={styles.now} aria-label={`${t('homeDayNow')} ${nowText}`}>
        <span className={styles.time}>{nowText}</span><span>{t('homeDayNow')}</span>
    </li>;

    return (
        <section className={styles.card} aria-labelledby="home-day-title" data-part="home-day">
            {taskInEditor && <TaskEditDialog task={taskInEditor} onClose={() => setOpen(null)} />}
            <div className={styles.head}><h2 id="home-day-title">{t('homeDayTitle')}</h2><small>{date}</small></div>
            {!loaded ? <Bone h="6rem" />
                : items.length === 0
                ? <p className={styles.empty}>{t('homeDayEmpty')}</p>
                : <ol className={styles.list}>
                    {items.map((item, i) => [i === nowAt && nowRow, row(item)])}
                    {nowAt === -1 && nowRow}
                </ol>}
            <FocusToday />
        </section>
    );
}

// "40 min focus today · goal 120 min", the goal a select; a thin line for how far it is
function FocusToday() {
    const { t } = useTranslation();
    const serverMin = useSelector(state => state.progress.data?.todayFocusMin ?? 0);
    const runningSec = useSelector(state => state.session.currentSessionData.totalTime);
    const [goal, setGoal] = useState(readStoredFocusGoal);
    const minutes = serverMin + Math.floor(runningSec / 60);
    const share = Math.min(1, minutes / goal);
    return (
        <div className={styles.focus}>
            <p>
                <span>{fill(t('homeDayFocus'), { n: minutes })}</span>
                <label className={styles.goal}>
                    <span>{t('dashFocusGoal')}</span>
                    <select value={goal} onChange={e => { const g = Number(e.target.value); setGoal(g); storeFocusGoal(g); }}>
                        {FOCUS_GOALS.map(g => <option key={g} value={g}>{fill(t('minutesShort'), { n: g })}</option>)}
                    </select>
                </label>
            </p>
            <span className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(minutes, goal)}
                aria-label={t('dashFocusTitle')}>
                <i style={{ transform: `scaleX(${share})` }} />
            </span>
        </div>
    );
}
