import styles from './WeekDaysContainer.module.css';
import { Link } from  'react-router-dom';
import { useSelector } from "react-redux"
import {useTranslation} from '../i18n/useTranslation'
import { toDateOnly } from '../features/helperFunction'
import { addDays, dateKey, groupByDay, prioLevel, taskTimeText } from '../features/calendar/calendar'
import { taskColorAttr } from '../features/tasks/taskColors'
import { isEvent } from '../features/tasks/kinds'

const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MAX_VISIBLE_TASKS = 3;
const PRIO_CLASS = { high: styles.prioHigh, medium: styles.prioMedium, low: styles.prioLow };

// The next 8 days with their tasks and events; a day opens in the calendar. (The menu and the
// tab bar lead to the calendar itself, the title row's overdue count to its agenda.)
export default function WeekDaysContainer(){
    const {t} = useTranslation();

    const tasks = useSelector(state => state.task.tasks);

    const today = toDateOnly(new Date());
    const weekDates = Array.from({ length: 8 }, (_, i) => addDays(today, i));
    const tasksByDay = groupByDay(tasks);

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
                                        <li key={task.id} data-task-color={taskColorAttr(task)}
                                            className={[isEvent(task) ? styles.event : PRIO_CLASS[prioLevel(task.prio)], task.done && styles.done].filter(Boolean).join(' ') || undefined}
                                            title={[task.name, taskTimeText(task), task.event_type?.name].filter(Boolean).join(' · ')}>
                                            {/* the name has the chip's width, the time a quiet line under it */}
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
        </div>
    );
}
