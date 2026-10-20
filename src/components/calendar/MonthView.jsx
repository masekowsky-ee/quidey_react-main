import styles from '../Calendar.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { fill, monthGrid, sameDay, parseDate } from '../../features/helperFunction';
import { dateKey, isoWeek, startOfMonth, formatFocus } from '../../features/calendar/calendar';
import { useDayGridKeys } from '../../features/calendar/useDayGridKeys';
import TaskChip from './TaskChip.jsx';

const MAX_VISIBLE_TASKS = 3;

// The month as 6 weeks (Monday first) with the ISO week number in front of each row.
// A day shows its first tasks, how long I focused that day, and opens with a click or Enter.
export default function MonthView({ focusedDate, today, tasksByDay, focusByDay, drag, startDrag, onFocusDate, onOpenDate, onOpenWeek, dayLabel }) {
    const { t } = useTranslation();
    const { gridRef, onKeyDown, focusedKey } = useDayGridKeys({ focusedDate, onFocusDate, onOpenDate });

    const days = monthGrid(startOfMonth(focusedDate));
    const weeks = Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7));

    return (
        <div className={styles.monthCard}>
            <div className={styles.month} role="grid" ref={gridRef} onKeyDown={onKeyDown} aria-label={`${t('months', focusedDate.getMonth())} ${focusedDate.getFullYear()}`}>
                <div className={styles.monthRow} role="row">
                    <span className={styles.weekNumHead} role="columnheader" aria-label={t('weekShort')}>{t('weekShort')}</span>
                    {Array.from({ length: 7 }, (_, i) => (
                        <span key={i} role="columnheader" aria-label={t('weekDaysFull', i)} className={`${styles.weekdayHead} ${i >= 5 ? styles.weekend : ''}`}>
                            {t('weekDays', i)}
                        </span>
                    ))}
                </div>

                {weeks.map(week => {
                    const weekNumber = isoWeek(week[0]);
                    return (
                        <div className={styles.monthRow} role="row" key={dateKey(week[0])}>
                            <span role="rowheader" className={styles.weekNumCell}>
                                <button type="button" className={styles.weekNum} tabIndex={-1} onClick={() => onOpenWeek(week[0])}
                                    title={fill(t('weekNumber'), { week: weekNumber })} aria-label={fill(t('weekNumber'), { week: weekNumber })}>
                                    {weekNumber}
                                </button>
                            </span>
                            {week.map(date => {
                                const key = dateKey(date);
                                const dayTasks = tasksByDay[key] ?? [];
                                const focusSeconds = focusByDay[key]?.seconds ?? 0;
                                const outside = date.getMonth() !== focusedDate.getMonth();
                                const classes = [
                                    styles.cell,
                                    outside && styles.outside,
                                    sameDay(date, today) && styles.todayCell,
                                    key === focusedKey && styles.focusedCell,
                                    drag && drag.over === key && styles.dropTarget,
                                ].filter(Boolean).join(' ');
                                return (
                                    <div
                                        key={key}
                                        role="gridcell"
                                        data-date={key}
                                        tabIndex={key === focusedKey ? 0 : -1}
                                        aria-selected={key === focusedKey}
                                        aria-current={sameDay(date, today) ? 'date' : undefined}
                                        className={classes}
                                        onClick={() => onOpenDate(date)}
                                    >
                                        <span className={styles.srOnly}>{dayLabel(date, dayTasks.length)}</span>
                                        <div className={styles.cellHead} aria-hidden="true">
                                            <span className={styles.dayNum}>{date.getDate()}</span>
                                            {focusSeconds >= 60 &&
                                                <span className={styles.focusBadge} title={`${t('focusOnDay')}: ${formatFocus(focusSeconds)}`}>{formatFocus(focusSeconds, true)}</span>}
                                        </div>
                                        {dayTasks.length > 0 &&
                                            <ul className={styles.chips}>
                                                {dayTasks.slice(0, MAX_VISIBLE_TASKS).map(task => (
                                                    <li key={task.id}>
                                                        <TaskChip task={task} today={today} startDrag={task.projected ? undefined : startDrag}
                                                            dragging={drag?.task.id === task.id}
                                                            onOpen={() => task.projected ? onOpenDate(parseDate(dateKey(task.repeatOf.due)), task.repeatOf.id) : onOpenDate(date, task.id)} />
                                                    </li>
                                                ))}
                                                {dayTasks.length > MAX_VISIBLE_TASKS &&
                                                    <li className={styles.chipMore}>{fill(t('moreTasks'), { count: dayTasks.length - MAX_VISIBLE_TASKS })}</li>}
                                            </ul>
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
