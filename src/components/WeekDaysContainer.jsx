import styles from './WeekDaysContainer.module.css';
import { Link } from  'react-router-dom';
import { useSelector } from "react-redux"
import {useTranslation} from '../i18n/useTranslation'
import { fill, isOverdue, toDateOnly } from '../features/helperFunction'
import { addDays, dateKey, groupByDay, prioLevel } from '../features/calendar/calendar'

const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MAX_VISIBLE_TASKS = 3;
const PRIO_CLASS = { high: styles.prioHigh, medium: styles.prioMedium, low: styles.prioLow };

// The next 8 days with their tasks. A day opens in the calendar; the calendar card
// shows how many tasks are overdue and then goes to the agenda.
export default function WeekDaysContainer(){
    const {t} = useTranslation();

    const tasks = useSelector(state => state.task.tasks);

    const today = toDateOnly(new Date());
    const weekDates = Array.from({ length: 8 }, (_, i) => addDays(today, i));
    const tasksByDay = groupByDay(tasks);
    const overdueCount = tasks.filter(task => isOverdue(task, today)).length;
    const todayKey = dateKey(today);

    return (
        <div className={styles.weekStrip}>
            <div className={styles.days}>
                {weekDates.map((date, i) => {
                    const key = dateKey(date);
                    const dayTasks = tasksByDay[key] ?? [];
                    return (
                        <Link to={`/calendar?date=${key}&day=${key}`} className={`${styles.day} ${i === 0 ? styles.today : ''}`} key={key}>
                            <div className={styles.dayHead}>
                                <span className={styles.weekday}>{i === 0 ? t('today') : t(days[date.getDay()])}</span>
                                <span className={styles.dayNum}>{date.getDate()}.{date.getMonth() + 1}</span>
                            </div>
                            {dayTasks.length === 0
                                ? <span className={styles.empty}>–</span>
                                : <ul className={styles.dayList}>
                                    {dayTasks.slice(0, MAX_VISIBLE_TASKS).map(task => (
                                        <li key={task.id} className={[PRIO_CLASS[prioLevel(task.prio)], task.done && styles.done].filter(Boolean).join(' ') || undefined} title={[task.name, task.due_time].filter(Boolean).join(' ')}>
                                            {/* name first; a long one is cut, the time stays visible */}
                                            <span className={styles.name}>{task.name}</span>
                                            {task.due_time && <span className={styles.time}>{task.due_time}</span>}
                                        </li>
                                    ))}
                                    {dayTasks.length > MAX_VISIBLE_TASKS &&
                                        <li className={styles.more}>+{dayTasks.length - MAX_VISIBLE_TASKS}</li>}
                                </ul>
                            }
                        </Link>
                    );
                })}
            </div>

            <Link
                to={overdueCount > 0 ? `/calendar?view=agenda&date=${todayKey}` : '/calendar'}
                className={`${styles.calendarLink} ${overdueCount > 0 ? styles.calendarLinkOverdue : ''}`}
                title={overdueCount > 0 ? fill(t('overdueCount'), { count: overdueCount }) : t('calendar')}
                aria-label={overdueCount > 0 ? `${t('calendar')}: ${fill(t('overdueCount'), { count: overdueCount })}` : t('calendar')}
            >
                <svg className={styles.calendarIconSvg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-188.5-11.5Q280-423 280-440t11.5-28.5Q303-480 320-480t28.5 11.5Q360-457 360-440t-11.5 28.5Q337-400 320-400t-28.5-11.5ZM640-400q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-188.5-11.5Q280-263 280-280t11.5-28.5Q303-320 320-320t28.5 11.5Q360-297 360-280t-11.5 28.5Q337-240 320-240t-28.5-11.5ZM640-240q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z"/></svg>
                <span>{t('calendar')}</span>
                {overdueCount > 0 && <span className={styles.overdueBadge} aria-hidden="true">{overdueCount}</span>}
            </Link>
        </div>
    );
}
