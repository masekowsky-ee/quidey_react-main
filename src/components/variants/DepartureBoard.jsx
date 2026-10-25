import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import styles from './DepartureBoard.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { dueText, fill, isOverdue, parseDate, sameDay } from '../../features/helperFunction';
import { dateKey, minutesOfDay, timeText } from '../../features/calendar/calendar';
import { isEvent } from '../../features/tasks/kinds';
import { taskColorAttr } from '../../features/tasks/taskColors';

const SHOWN = 8;
const NOW_WINDOW_MIN = 5;

// What a row's last column says, and whether it is a change worth the board's yellow
function noteOf(task, nowMin, activeId, t) {
    if (task.id === activeId) return { text: t('boardFocus'), state: 'now' };
    if (isOverdue(task)) return { text: t('boardLate'), state: 'late' };
    const start = minutesOfDay(task.due_time);
    if (start === null) return { text: t('boardAllDay'), state: null };
    const end = start + (isEvent(task) ? Number(task.duration_minutes) || 0 : 0);
    if (isEvent(task) && start <= nowMin && nowMin < end) return { text: t('boardRunning'), state: 'now' };
    const until = start - nowMin;
    if (Math.abs(until) <= NOW_WINDOW_MIN) return { text: t('boardNow'), state: 'now' };
    if (until < 0) return { text: t('boardLate'), state: 'late' };
    if (until < 60) return { text: fill(t('boardInMin'), { min: until }), state: until <= 15 ? 'soon' : null };
    return { text: fill(t('boardInHours'), { hours: Math.floor(until / 60) }), state: null };
}

// The "Abfahrtstafel" variant's Home: today as a station's departure board. What is still to
// come today (and what was left over), by time: time | name | group | note. Yellow only for
// what is happening now or about to.
export default function DepartureBoard({ tasks, activeTask }) {
    const { t } = useTranslation();
    const groups = useSelector(state => state.task.groups);
    // the board counts on by the minute
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 30 * 1000);
        return () => clearInterval(id);
    }, []);
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const today = tasks.filter(task => {
        if (task.done) return false;
        const due = parseDate(task.due);
        return (due && sameDay(due, now)) || isOverdue(task, now);
    });
    // left over first, then by time, the ones without a time last
    const order = (task) => isOverdue(task, now) ? -1 : minutesOfDay(task.due_time) ?? 2000;
    const rows = [...today].sort((a, b) => order(a) - order(b));
    const groupOf = (task) => task.shared?.sessionName
        ?? (task.group_ids ?? []).map(id => groups.find(group => group.id === id)).find(group => group && group.name !== 'all')?.name
        ?? '';

    return (
        <section className={styles.board} aria-labelledby="board-title" data-part="board">
            <div className={styles.head}>
                <h2 id="board-title" className={styles.title}>{t('boardTitle')}</h2>
                <time className={styles.clock} dateTime={now.toISOString()}>{timeText(nowMin)}</time>
            </div>
            {rows.length === 0
                ? <p className={styles.empty}>{t('boardEmpty')}</p>
                : <table className={styles.table}>
                    <thead>
                        <tr>
                            <th scope="col" className={styles.time}>{t('boardTime')}</th>
                            <th scope="col">{t('boardWhat')}</th>
                            <th scope="col" className={styles.track}>{t('boardTrack')}</th>
                            <th scope="col" className={styles.note}>{t('boardNote')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.slice(0, SHOWN).map(task => {
                            const note = noteOf(task, nowMin, activeTask?.id, t);
                            const start = minutesOfDay(task.due_time);
                            return (
                                <tr key={`${task.shared ? 's' : 'o'}${task.id}`} data-state={note.state ?? undefined} data-task-color={taskColorAttr(task)}>
                                    <td className={styles.time}>
                                        {isOverdue(task, now) ? dueText(task.due, t, now) : start === null ? '–' : timeText(start)}
                                    </td>
                                    <td className={styles.what}>{task.name}</td>
                                    <td className={styles.track}>{groupOf(task)}</td>
                                    <td className={styles.note}>
                                        {/* keyed by the text, so a change flips in like on the board */}
                                        <span key={note.text} className={styles.flip}>{note.text}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>}
            {rows.length > SHOWN &&
                <Link to={`/calendar?view=agenda&date=${dateKey(now)}`} className={styles.more}>
                    {fill(t('boardMore'), { count: rows.length - SHOWN })}
                </Link>}
        </section>
    );
}
