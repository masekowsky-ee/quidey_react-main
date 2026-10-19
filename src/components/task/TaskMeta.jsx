import styles from './TaskOptions.module.css';
import { useTranslation } from '../../i18n/useTranslation';
import { durationText, taskTimeText } from '../../features/calendar/calendar';

// One line under a task: its time (or duration), location and link. Nothing when none is set.
export default function TaskMeta({ task, showTime = true }) {
    const { t } = useTranslation();
    const time = showTime ? taskTimeText(task) : '';
    const duration = !task.due_time && task.duration_minutes ? durationText(task.duration_minutes) : '';
    if (!time && !duration && !task.location && !task.link) return null;
    return (
        <span className={styles.meta}>
            {time && <span className={styles.metaTime}>{time}</span>}
            {duration && <span>{duration}</span>}
            {task.location && <span className={styles.metaLocation} title={t('location')}>{task.location}</span>}
            {task.link &&
                <a className={styles.metaLink} href={task.link} target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()} title={task.link}>
                    {t('openLink')} ↗
                </a>}
        </span>
    );
}
