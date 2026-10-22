import styles from './TaskOptions.module.css';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../i18n/useTranslation';
import { fill } from '../../features/helperFunction';
import { durationText, taskTimeText } from '../../features/calendar/calendar';
import { isEvent } from '../../features/tasks/kinds';
import { plannedProgress, selectFocusByTask } from '../../features/tasks/plannedTime';
import { TASK_COLORS } from '../../features/tasks/taskColors';

// One line under a task: its time, an event's type (and length when it has no time), a task's
// planned time against the focus spent on it, location and link. Nothing when none is set.
export default function TaskMeta({ task, showTime = true }) {
    const { t } = useTranslation();
    const focusByTask = useSelector(selectFocusByTask);
    const event = isEvent(task);
    const time = showTime ? taskTimeText(task) : '';
    // an event's length shows in its time ("09:00–17:00"); without a time it stands alone
    const length = event && (!task.due_time || !showTime) && task.duration_minutes ? durationText(task.duration_minutes) : '';
    const type = event ? task.event_type : null;
    const progress = plannedProgress(task, focusByTask);
    if (!time && !length && !type && !progress && !task.location && !task.link) return null;
    return (
        <span className={styles.meta}>
            {time && <span className={styles.metaTime}>{time}</span>}
            {type &&
                <span className={styles.metaType} data-task-color={TASK_COLORS.includes(type.color) ? type.color : undefined}>
                    {type.name}
                </span>}
            {length && <span>{length}</span>}
            {progress &&
                <span className={styles.metaPlanned}
                    title={fill(t('plannedProgress'), { spent: durationText(progress.spent), planned: durationText(progress.planned) })}>
                    {progress.spent > 0
                        ? `${durationText(progress.spent)} / ${durationText(progress.planned)}`
                        : fill(t('plannedShort'), { time: durationText(progress.planned) })}
                    {progress.spent > 0 &&
                        <span className={styles.metaPlannedBar} aria-hidden="true"
                            style={{ '--share': Math.min(1, progress.share) }} data-over={progress.share > 1 ? '' : undefined} />}
                </span>}
            {task.location && <span className={styles.metaLocation} title={t('location')}>{task.location}</span>}
            {task.link &&
                <a className={styles.metaLink} href={task.link} target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()} title={task.link}>
                    {t('openLink')} ↗
                </a>}
        </span>
    );
}
