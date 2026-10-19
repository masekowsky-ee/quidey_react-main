import styles from '../Calendar.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { fill, sameDay } from '../../features/helperFunction';
import { dateKey, weekDates, formatFocus } from '../../features/calendar/calendar';
import { useDayGridKeys } from '../../features/calendar/useDayGridKeys';
import TaskChip from './TaskChip.jsx';
import Icon from './icons.jsx';

// Monday to Sunday side by side (stacked on phones), every task of a day with its description.
export default function WeekView({ focusedDate, today, tasksByDay, focusByDay, drag, startDrag, onFocusDate, onOpenDate, dayLabel, longDate }) {
    const { t } = useTranslation();
    const { gridRef, onKeyDown, focusedKey } = useDayGridKeys({ focusedDate, onFocusDate, onOpenDate });

    return (
        <div className={styles.week} role="grid" ref={gridRef} onKeyDown={onKeyDown}>
            <div className={styles.weekRow} role="row">
                {weekDates(focusedDate).map((date, i) => {
                    const key = dateKey(date);
                    const dayTasks = tasksByDay[key] ?? [];
                    const focusSeconds = focusByDay[key]?.seconds ?? 0;
                    const isToday = sameDay(date, today);
                    const classes = [
                        styles.weekDay,
                        isToday && styles.weekToday,
                        i >= 5 && styles.weekWeekend,
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
                            aria-current={isToday ? 'date' : undefined}
                            className={classes}
                            onClick={() => onOpenDate(date)}
                        >
                            <span className={styles.srOnly}>{dayLabel(date, dayTasks.length)}</span>
                            <div className={styles.weekDayHead} aria-hidden="true">
                                <span className={styles.weekDayName}>{isToday ? t('today') : t('weekDays', i)}</span>
                                <span className={styles.weekDayNum}>{date.getDate()}</span>
                                {focusSeconds >= 60 &&
                                    <span className={styles.focusBadge} title={`${t('focusOnDay')}: ${formatFocus(focusSeconds)}`}>{formatFocus(focusSeconds, true)}</span>}
                            </div>
                            {dayTasks.length > 0
                                ? <ul className={styles.weekList}>
                                    {dayTasks.map(task => (
                                        <li key={task.id}>
                                            <TaskChip task={task} today={today} startDrag={startDrag} showDescription
                                                dragging={drag?.task.id === task.id}
                                                onOpen={() => onOpenDate(date, task.id)} />
                                        </li>
                                    ))}
                                </ul>
                                : <span className={styles.weekEmpty} aria-hidden="true">–</span>
                            }
                            <button
                                type="button"
                                className={styles.weekAdd}
                                tabIndex={-1}
                                onClick={(e) => { e.stopPropagation(); onOpenDate(date, 'new'); }}
                                aria-label={fill(t('addTaskOnDay'), { date: longDate(date) })}
                                title={fill(t('addTaskOnDay'), { date: longDate(date) })}
                            >
                                <Icon name="add" size={18} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
