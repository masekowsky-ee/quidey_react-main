import styles from '../Calendar.module.css';
import { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate, isOverdue, parseDate, sameDay } from '../../features/helperFunction';
import { compareTasks, dateKey, monthDates, prioLevel } from '../../features/calendar/calendar';
import TaskLabels from '../TaskLabels.jsx';
import TaskMeta from '../task/TaskMeta.jsx';
import Icon from './icons.jsx';
import { taskColorAttr } from '../../features/tasks/taskColors';

const PRIO_CLASS = { high: styles.prioHigh, medium: styles.prioMedium, low: styles.prioLow };
const PRIO_TEXT = { high: 'prioHigh', medium: 'prioMedium', low: 'prioLow' };

// A task without a day gets one here: pick the date, then "Schedule"
function ScheduleField({ task, onSchedule }) {
    const { t } = useTranslation();
    const [day, setDay] = useState('');
    return (
        <form className={styles.scheduleForm} onSubmit={(e) => { e.preventDefault(); if (day) onSchedule(task, day); }}>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label={`${t('dueDate')}: ${task.name}`} />
            <button type="submit" disabled={!day}>{t('scheduleTask')}</button>
        </form>
    );
}

function AgendaRow({ task, today, showDate, onOpenTask, onToggleDone, onSchedule, onOpenGroup }) {
    const { t } = useTranslation();
    const level = prioLevel(task.prio);
    const classes = [styles.agendaRow, PRIO_CLASS[level], task.done && styles.agendaDone].filter(Boolean).join(' ');
    return (
        <li className={classes} data-task-color={taskColorAttr(task)}>
            <button type="button" className={styles.check} aria-pressed={Boolean(task.done)} onClick={() => onToggleDone(task)}
                aria-label={`${t(task.done ? 'reopen' : 'markDone')}: ${task.name}`} title={t(task.done ? 'reopen' : 'markDone')}>
                <Icon name="check" size={16} />
            </button>
            <div className={styles.agendaText}>
                {task.due
                    ? <button type="button" className={styles.agendaName} onClick={() => onOpenTask(task)}>{task.name}</button>
                    : <span className={styles.agendaName}>{task.name}</span>}
                <TaskMeta task={task} />
                {task.description && <p className={styles.agendaDesc}>{task.description}</p>}
                <TaskLabels task={task} onOpenGroup={onOpenGroup} />
            </div>
            <div className={styles.agendaMeta}>
                {showDate && <span className={isOverdue(task, today) ? styles.agendaDueLate : styles.agendaDue}>{formatDate(task.due)}</span>}
                {level && <span className={styles.prioDot} title={`${t(PRIO_TEXT[level])} (${task.prio})`} aria-label={t(PRIO_TEXT[level])} />}
                {!task.due && <ScheduleField task={task} onSchedule={onSchedule} />}
            </div>
        </li>
    );
}

// The focused month as a list: overdue tasks first (in the current month), then every
// day that has tasks, today always included, and tasks without a date at the end.
export default function AgendaView({ focusedDate, today, tasks, tasksByDay, onOpenDate, onToggleDone, onSchedule, onOpenGroup, longDate, filtersActive, onClearFilters }) {
    const { t } = useTranslation();
    const isCurrentMonth = focusedDate.getFullYear() === today.getFullYear() && focusedDate.getMonth() === today.getMonth();

    const overdue = isCurrentMonth
        ? tasks.filter(task => isOverdue(task, today)).sort((a, b) => parseDate(a.due) - parseDate(b.due) || compareTasks(a, b))
        : [];
    // overdue tasks are only listed under "Overdue", not again on their day
    const tasksOn = (date) => (tasksByDay[dateKey(date)] ?? []).filter(task => !isCurrentMonth || !isOverdue(task, today));
    const days = monthDates(focusedDate).filter(date => tasksOn(date).length > 0 || sameDay(date, today));
    const undated = tasks.filter(task => !task.due).sort(compareTasks);
    const hasAny = overdue.length > 0 || undated.length > 0 || days.some(date => tasksOn(date).length > 0);

    const openTask = (task) => onOpenDate(parseDate(task.due), task.id);
    const rowProps = { today, onOpenTask: openTask, onToggleDone, onSchedule, onOpenGroup };

    return (
        <div className={styles.agenda}>
            {overdue.length > 0 &&
                <section className={`${styles.agendaSection} ${styles.agendaOverdue}`}>
                    <h2 className={styles.agendaHead}><span className={styles.agendaHeadDate}>{t('overdue')}</span><span className={styles.agendaCount}>{overdue.length}</span></h2>
                    <ul className={styles.agendaList}>
                        {overdue.map(task => <AgendaRow key={task.id} task={task} showDate {...rowProps} />)}
                    </ul>
                </section>
            }

            {days.map(date => {
                const key = dateKey(date);
                const dayTasks = tasksOn(date);
                const isToday = sameDay(date, today);
                return (
                    <section key={key} className={`${styles.agendaSection} ${isToday ? styles.agendaToday : ''}`} data-date={key}>
                        <h2 className={styles.agendaHead}>
                            <button type="button" className={styles.agendaHeadDate} onClick={() => onOpenDate(date)}>
                                {longDate(date, true)}
                            </button>
                            {isToday && <span className={styles.todayTag}>{t('today')}</span>}
                            {dayTasks.length > 0 && <span className={styles.agendaCount}>{dayTasks.length}</span>}
                        </h2>
                        {dayTasks.length > 0
                            ? <ul className={styles.agendaList}>
                                {dayTasks.map(task => <AgendaRow key={task.id} task={task} {...rowProps} />)}
                            </ul>
                            : <button type="button" className={styles.agendaEmptyDay} onClick={() => onOpenDate(date, 'new')}>
                                <Icon name="add" size={18} />{t('noTasks')}
                            </button>
                        }
                    </section>
                );
            })}

            {undated.length > 0 &&
                <section className={styles.agendaSection}>
                    <h2 className={styles.agendaHead}><span className={styles.agendaHeadDate}>{t('noDate')}</span><span className={styles.agendaCount}>{undated.length}</span></h2>
                    <ul className={styles.agendaList}>
                        {undated.map(task => <AgendaRow key={task.id} task={task} {...rowProps} />)}
                    </ul>
                </section>
            }

            {!hasAny &&
                <div className={styles.agendaEmpty}>
                    <p>{filtersActive ? t('calendarNoMatches') : t('calendarEmptyMonth')}</p>
                    {filtersActive && <button type="button" onClick={onClearFilters}>{t('clearFilters')}</button>}
                </div>
            }
        </div>
    );
}
