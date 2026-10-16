import styles from './WeekDaysContainer.module.css';
import { Link } from  'react-router-dom';
import { useSelector } from "react-redux"
import {useTranslation} from '../i18n/useTranslation'

const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MAX_VISIBLE_TASKS = 3;

function toDateOnly(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export default function WeekDaysContainer(){
    const {t} = useTranslation();

    const tasks = useSelector(state => state.task.tasks);

    const today = new Date();
    const weekDates = Array.from(
        { length: 8 },
        (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
    );

    const tasksForDate = (date) => {
        const day = toDateOnly(date).getTime();
        return tasks.filter(task => task.due && toDateOnly(new Date(task.due)).getTime() === day);
    }

    return (
        <div className={styles.weekStrip}>
            <div className={styles.days}>
                {weekDates.map((date, i) => {
                    const dayTasks = tasksForDate(date);
                    return (
                        <div className={`${styles.day} ${i === 0 ? styles.today : ''}`} key={i}>
                            <div className={styles.dayHead}>
                                <span className={styles.weekday}>{i === 0 ? t('today') : t(days[date.getDay()])}</span>
                                <span className={styles.dayNum}>{date.getDate()}.{date.getMonth() + 1}</span>
                            </div>
                            {dayTasks.length === 0
                                ? <span className={styles.empty}>–</span>
                                : <ul className={styles.dayList}>
                                    {dayTasks.slice(0, MAX_VISIBLE_TASKS).map(task => (
                                        <li key={task.id} className={task.done ? styles.done : undefined} title={task.name}>
                                            {task.name}
                                        </li>
                                    ))}
                                    {dayTasks.length > MAX_VISIBLE_TASKS &&
                                        <li className={styles.more}>+{dayTasks.length - MAX_VISIBLE_TASKS}</li>}
                                </ul>
                            }
                        </div>
                    );
                })}
            </div>

            <Link to="/calendar" className={styles.calendarLink} title={t('calendar')} aria-label={t('calendar')}>
                <svg className={styles.calendarIconSvg} xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-188.5-11.5Q280-423 280-440t11.5-28.5Q303-480 320-480t28.5 11.5Q360-457 360-440t-11.5 28.5Q337-400 320-400t-28.5-11.5ZM640-400q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-188.5-11.5Q280-263 280-280t11.5-28.5Q303-320 320-320t28.5 11.5Q360-297 360-280t-11.5 28.5Q337-240 320-240t-28.5-11.5ZM640-240q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z"/></svg>
                <span>{t('calendar')}</span>
            </Link>
        </div>
    );
}
