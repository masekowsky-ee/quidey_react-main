import styles from './Calendar.module.css';
import { useState, useEffect } from 'react';
import { useSelector } from "react-redux"
import {useTranslation} from '../i18n/LanguageContext'
import { formatDate } from '../features/helperFunction'

const MAX_VISIBLE_TASKS = 3;

function toDateOnly(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a, b) {
    return toDateOnly(a).getTime() === toDateOnly(b).getTime();
}

// Monday = 0 ... Sunday = 6, matching the weekDays translations
function mondayIndex(date) {
    return (date.getDay() + 6) % 7;
}

// Always 6 weeks, starting on the Monday on/before the 1st, so the grid never jumps in height
function monthGrid(viewMonth) {
    const start = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1 - mondayIndex(viewMonth));
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

const icons = {
    prev: "m432-480 156 156q11 11 11 28t-11 28q-11 11-28 11t-28-11L348-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l184-184q11-11 28-11t28 11q11 11 11 28t-11 28L432-480Z",
    next: "M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z",
    close: "m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z",
};

function Icon({ path }) {
    return <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d={path}/></svg>;
}

export default function Calendar(){
    const { t } = useTranslation();

    const tasks = useSelector(state => state.task.tasks)

    const today = toDateOnly(new Date());
    const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState(null);

    const isCurrentMonth = viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() === today.getMonth();

    const tasksForDate = (date) => tasks.filter(task => task.due && sameDay(new Date(task.due), date));

    const shiftMonth = (direction) => {
        setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
    }

    const selectDate = (date) => {
        setSelectedDate(date);
        setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }

    const shiftDay = (direction) => {
        selectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + direction));
    }

    const goToToday = () => {
        if (selectedDate) selectDate(today);
        else setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    }

    // Esc closes the day panel
    useEffect(() => {
        if (!selectedDate) return;
        const onKey = (e) => { if (e.key === 'Escape') setSelectedDate(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedDate]);

    const selectedTasks = selectedDate ? tasksForDate(selectedDate) : [];

    return (
        <div className={styles.page}>
            <div className={styles.toolbar}>
                <h1 className={styles.monthTitle}>{`${t('months', viewMonth.getMonth())} ${viewMonth.getFullYear()}`}</h1>
                <div className={styles.toolbarActions}>
                    {!isCurrentMonth && <button className={styles.todayBtn} onClick={goToToday}>{t('today')}</button>}
                    <button className={styles.navBtn} onClick={() => shiftMonth(-1)} aria-label="previous month"><Icon path={icons.prev}/></button>
                    <button className={styles.navBtn} onClick={() => shiftMonth(1)} aria-label="next month"><Icon path={icons.next}/></button>
                </div>
            </div>

            <div className={styles.calendar}>
                <div className={styles.weekdays}>
                    {Array.from({ length: 7 }).map((_, i) => (
                        <span key={i} className={i >= 5 ? styles.weekend : undefined}>{t('weekDays', i)}</span>
                    ))}
                </div>
                <div className={styles.grid}>
                    {monthGrid(viewMonth).map((date) => {
                        const dayTasks = tasksForDate(date);
                        const outside = date.getMonth() !== viewMonth.getMonth();
                        const isToday = sameDay(date, today);
                        return (
                            <button
                                key={date.getTime()}
                                className={`${styles.cell} ${outside ? styles.outside : ''} ${isToday ? styles.todayCell : ''}`}
                                onClick={() => selectDate(date)}
                            >
                                <span className={styles.dayNum}>{date.getDate()}</span>
                                {dayTasks.length > 0 &&
                                    <ul className={styles.chips}>
                                        {dayTasks.slice(0, MAX_VISIBLE_TASKS).map(task => (
                                            <li key={task.id} className={task.done ? styles.chipDone : undefined}>{task.name}</li>
                                        ))}
                                        {dayTasks.length > MAX_VISIBLE_TASKS &&
                                            <li className={styles.chipMore}>+{dayTasks.length - MAX_VISIBLE_TASKS}</li>}
                                    </ul>
                                }
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedDate &&
                <div className={styles.backdrop} onClick={() => setSelectedDate(null)}>
                    <div className={styles.dayPanel} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                        <div className={styles.dayPanelHead}>
                            <button className={styles.navBtn} onClick={() => shiftDay(-1)} aria-label="previous day"><Icon path={icons.prev}/></button>
                            <div className={styles.dayPanelTitle}>
                                <span className={styles.dayPanelWeekday}>{t('weekDaysFull', mondayIndex(selectedDate))}</span>
                                <h2>{`${selectedDate.getDate()}. ${t('months', selectedDate.getMonth())} ${selectedDate.getFullYear()}`}</h2>
                            </div>
                            <button className={styles.navBtn} onClick={() => shiftDay(1)} aria-label="next day"><Icon path={icons.next}/></button>
                            <button className={styles.closeBtn} onClick={() => setSelectedDate(null)} aria-label="close"><Icon path={icons.close}/></button>
                        </div>
                        {selectedTasks.length > 0
                            ? <ul className={styles.dayTasks}>
                                {selectedTasks.map(task => (
                                    <li key={task.id} className={task.done ? styles.dayTaskDone : undefined}>
                                        <span className={styles.dayTaskName}>{task.name}</span>
                                        {task.description && <span className={styles.dayTaskDesc}>{task.description}</span>}
                                        <span className={styles.dayTaskDue}>{formatDate(task.due)}</span>
                                    </li>
                                ))}
                            </ul>
                            : <p className={styles.dayEmpty}>{t('noTasks')}</p>
                        }
                    </div>
                </div>
            }
        </div>
    )
}
