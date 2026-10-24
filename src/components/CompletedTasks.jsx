import styles from './stats/SessionList.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../i18n/useTranslation';
import { updateTaskProps } from '../features/tasks/taskAction';
import { formatDate } from '../features/helperFunction';
import TaskLabels from './TaskLabels.jsx';

import Icon from './icons';
const NO_DATE = 'unknown';

// The "completed tasks" folder of the history: every done task, grouped by the day it was
// completed, newest first. Tasks done before the app recorded the moment sit at the end.
// A task can be reopened from here.
export default function CompletedTasks() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const tasks = useSelector(state => state.task.tasks);
    const language = useSelector(state => state.settings.language);
    const locale = language === 'de' ? 'de-DE' : 'en-GB';

    // past events aren't ticked off: their time is in the statistics instead
    const done = tasks
        .filter(task => task.done && task.kind !== 'event')
        .sort((a, b) => (b.completed_at ? Date.parse(b.completed_at) : 0) - (a.completed_at ? Date.parse(a.completed_at) : 0));

    if (done.length === 0) return <div className={`${styles.card} ${styles.empty}`}>{t('noCompletedTasks')}</div>;

    // by day of completion, in the order above
    const days = [];
    for (const task of done) {
        const when = task.completed_at ? new Date(task.completed_at) : null;
        const key = when ? when.toDateString() : NO_DATE;
        let day = days.at(-1);
        if (!day || day.key !== key) days.push(day = { key, date: when, tasks: [] });
        day.tasks.push(task);
    }

    const dayText = (date) => date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeText = (date) => date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

    return (
        <>
            <p className={styles.folderCount}>{done.length} {t('completedTasksCount')}</p>
            <ul className={styles.list}>
                {days.map(day => (
                    <li key={day.key} className={styles.session}>
                        <p className={styles.sessionDate}>{day.date ? dayText(day.date) : t('completedUnknownDate')}</p>
                        <ul className={styles.doneList}>
                            {day.tasks.map(task => (
                                <li key={task.id} className={styles.doneRow}>
                                    <span className={styles.doneCheck} aria-hidden="true"><Icon name="check" size={14} strokeWidth={2.2} /></span>
                                    <div className={styles.doneText}>
                                        <span className={styles.doneName}>{task.name}</span>
                                        <span className={styles.sessionMeta}>
                                            {task.completed_at && `${t('completedAt')} ${timeText(new Date(task.completed_at))}`}
                                            {task.completed_at && task.due && ' · '}
                                            {task.due && `${t('dueOn')} ${formatDate(task.due)}`}
                                        </span>
                                        <TaskLabels task={task} />
                                    </div>
                                    <button className={styles.reopenBtn} onClick={() => dispatch(updateTaskProps({ done: false }, task))}
                                        aria-label={`${t('reopen')}: ${task.name}`}>
                                        {t('reopen')}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
        </>
    );
}
